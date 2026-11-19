-- 0004_asset_rpc.sql
-- Atomic PostgreSQL RPC functions for asset operations

-- Assign Asset to Employee
CREATE OR REPLACE FUNCTION public.process_asset_assignment(
    p_org_id UUID,
    p_asset_id UUID,
    p_employee_id UUID,
    p_assigned_at TIMESTAMPTZ DEFAULT now(),
    p_expected_return_date DATE DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role TEXT;
    v_user_id UUID;
    v_asset_status TEXT;
    v_employee_status TEXT;
    v_assignment_id UUID;
BEGIN
    v_user_id := auth.uid();

    SELECT role INTO v_role FROM public.organization_members 
    WHERE organization_id = p_org_id AND user_id = v_user_id;

    IF v_role IS NULL OR v_role NOT IN ('super_admin', 'admin', 'staff') THEN
        RAISE EXCEPTION 'Unauthorized: User does not have permission to assign assets';
    END IF;

    -- Check employee
    SELECT status INTO v_employee_status 
    FROM public.employees 
    WHERE id = p_employee_id AND organization_id = p_org_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee not found';
    END IF;

    IF v_employee_status <> 'active' THEN
        RAISE EXCEPTION 'Cannot assign asset to an inactive employee';
    END IF;

    -- Lock and check asset
    SELECT status INTO v_asset_status 
    FROM public.assets 
    WHERE id = p_asset_id AND organization_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Asset not found';
    END IF;

    IF v_asset_status <> 'available' THEN
        RAISE EXCEPTION 'Asset is not available for assignment. Current status: %', v_asset_status;
    END IF;

    -- Check if there's any pending active assignment already
    IF EXISTS (
        SELECT 1 FROM public.asset_assignments 
        WHERE asset_id = p_asset_id AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Asset already has an active assignment';
    END IF;

    -- Insert active assignment
    INSERT INTO public.asset_assignments (
        organization_id,
        asset_id,
        employee_id,
        assigned_by,
        assigned_at,
        expected_return_date,
        assignment_notes,
        status,
        created_at
    ) VALUES (
        p_org_id,
        p_asset_id,
        p_employee_id,
        v_user_id,
        coalesce(p_assigned_at, now()),
        p_expected_return_date,
        p_notes,
        'active',
        now()
    ) RETURNING id INTO v_assignment_id;

    -- Update asset status to 'assigned'
    UPDATE public.assets 
    SET status = 'assigned', updated_at = now() 
    WHERE id = p_asset_id;

    -- Record audit log
    INSERT INTO public.audit_logs (
        organization_id,
        user_id,
        action,
        entity,
        entity_id,
        new_values,
        created_at
    ) VALUES (
        p_org_id,
        v_user_id,
        'ASSET_ASSIGNMENT',
        'assets',
        p_asset_id,
        jsonb_build_object(
            'assignment_id', v_assignment_id,
            'employee_id', p_employee_id,
            'assigned_at', coalesce(p_assigned_at, now()),
            'expected_return_date', p_expected_return_date
        ),
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'assignment_id', v_assignment_id,
        'asset_status', 'assigned'
    );
END;
$$;


-- Return Assigned Asset
CREATE OR REPLACE FUNCTION public.process_asset_return(
    p_org_id UUID,
    p_asset_id UUID,
    p_returned_condition TEXT,
    p_returned_notes TEXT DEFAULT NULL,
    p_returned_at TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role TEXT;
    v_user_id UUID;
    v_asset_status TEXT;
    v_assignment_id UUID;
    v_target_status TEXT := 'available';
BEGIN
    v_user_id := auth.uid();

    SELECT role INTO v_role FROM public.organization_members 
    WHERE organization_id = p_org_id AND user_id = v_user_id;

    IF v_role IS NULL OR v_role NOT IN ('super_admin', 'admin', 'staff') THEN
        RAISE EXCEPTION 'Unauthorized: User does not have permission to return assets';
    END IF;

    IF p_returned_condition NOT IN ('new', 'good', 'fair', 'poor', 'damaged') THEN
        RAISE EXCEPTION 'Invalid return condition: %', p_returned_condition;
    END IF;

    -- Lock asset
    SELECT status INTO v_asset_status 
    FROM public.assets 
    WHERE id = p_asset_id AND organization_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Asset not found';
    END IF;

    IF v_asset_status <> 'assigned' THEN
        RAISE EXCEPTION 'Cannot return asset that is not currently assigned. Current status: %', v_asset_status;
    END IF;

    -- Find active assignment
    SELECT id INTO v_assignment_id 
    FROM public.asset_assignments 
    WHERE asset_id = p_asset_id AND status = 'active'
    ORDER BY assigned_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No active assignment found for this asset';
    END IF;

    -- If damaged, status becomes damaged instead of available
    IF p_returned_condition = 'damaged' THEN
        v_target_status := 'damaged';
    ELSE
        v_target_status := 'available';
    END IF;

    -- Close active assignment
    UPDATE public.asset_assignments 
    SET 
        status = 'returned',
        returned_at = coalesce(p_returned_at, now()),
        returned_condition = p_returned_condition,
        returned_notes = p_returned_notes
    WHERE id = v_assignment_id;

    -- Update asset
    UPDATE public.assets 
    SET 
        status = v_target_status,
        condition = p_returned_condition,
        updated_at = now()
    WHERE id = p_asset_id;

    -- Audit log
    INSERT INTO public.audit_logs (
        organization_id,
        user_id,
        action,
        entity,
        entity_id,
        new_values,
        created_at
    ) VALUES (
        p_org_id,
        v_user_id,
        'ASSET_RETURN',
        'assets',
        p_asset_id,
        jsonb_build_object(
            'assignment_id', v_assignment_id,
            'returned_condition', p_returned_condition,
            'new_asset_status', v_target_status,
            'notes', p_returned_notes
        ),
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'assignment_id', v_assignment_id,
        'asset_status', v_target_status
    );
END;
$$;


-- Update Asset Status (e.g. Dispose, Maintenance, Repair)
CREATE OR REPLACE FUNCTION public.process_asset_status_change(
    p_org_id UUID,
    p_asset_id UUID,
    p_new_status TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role TEXT;
    v_user_id UUID;
    v_current_status TEXT;
BEGIN
    v_user_id := auth.uid();

    SELECT role INTO v_role FROM public.organization_members 
    WHERE organization_id = p_org_id AND user_id = v_user_id;

    IF v_role IS NULL OR v_role NOT IN ('super_admin', 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can change asset status';
    END IF;

    IF p_new_status NOT IN ('available', 'assigned', 'maintenance', 'damaged', 'lost', 'disposed') THEN
        RAISE EXCEPTION 'Invalid asset status: %', p_new_status;
    END IF;

    SELECT status INTO v_current_status 
    FROM public.assets 
    WHERE id = p_asset_id AND organization_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Asset not found';
    END IF;

    -- Prevent disposing or changing actively assigned asset
    IF v_current_status = 'assigned' AND p_new_status <> 'assigned' THEN
        RAISE EXCEPTION 'Cannot modify or dispose an actively assigned asset. Please return the asset first.';
    END IF;

    UPDATE public.assets 
    SET 
        status = p_new_status,
        notes = concat_ws(E'\n', notes, concat('[Status change to ', p_new_status, ']: ', p_notes)),
        updated_at = now()
    WHERE id = p_asset_id;

    INSERT INTO public.audit_logs (
        organization_id,
        user_id,
        action,
        entity,
        entity_id,
        old_values,
        new_values,
        created_at
    ) VALUES (
        p_org_id,
        v_user_id,
        'ASSET_STATUS_CHANGE',
        'assets',
        p_asset_id,
        jsonb_build_object('status', v_current_status),
        jsonb_build_object('status', p_new_status, 'notes', p_notes),
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'old_status', v_current_status,
        'new_status', p_new_status
    );
END;
$$;
