-- 0003_stock_rpc.sql
-- Atomic PostgreSQL RPC functions for inventory operations

-- Stock In Function
CREATE OR REPLACE FUNCTION public.process_stock_in(
    p_org_id UUID,
    p_product_id UUID,
    p_warehouse_id UUID,
    p_quantity INTEGER,
    p_supplier_id UUID DEFAULT NULL,
    p_reference_number TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_idempotency_key UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role TEXT;
    v_user_id UUID;
    v_balance_before INTEGER := 0;
    v_balance_after INTEGER := 0;
    v_movement_id UUID;
    v_existing_movement RECORD;
    v_product_tracking TEXT;
BEGIN
    v_user_id := auth.uid();
    
    -- Permission check
    SELECT role INTO v_role FROM public.organization_members 
    WHERE organization_id = p_org_id AND user_id = v_user_id;

    IF v_role IS NULL OR v_role NOT IN ('super_admin', 'admin', 'staff') THEN
        RAISE EXCEPTION 'Unauthorized: User does not have permission to perform stock operations';
    END IF;

    -- Idempotency check
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id, balance_after INTO v_existing_movement 
        FROM public.stock_movements 
        WHERE idempotency_key = p_idempotency_key;
        
        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'movement_id', v_existing_movement.id,
                'balance_after', v_existing_movement.balance_after,
                'is_idempotent_replay', true
            );
        END IF;
    END IF;

    -- Validation
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be greater than zero';
    END IF;

    SELECT tracking_mode INTO v_product_tracking 
    FROM public.products 
    WHERE id = p_product_id AND organization_id = p_org_id AND status = 'active';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found or inactive';
    END IF;

    IF v_product_tracking <> 'bulk' THEN
        RAISE EXCEPTION 'Product tracking mode is not bulk';
    END IF;

    -- Lock and update/insert inventory balance
    SELECT quantity INTO v_balance_before 
    FROM public.inventory 
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id
    FOR UPDATE;

    IF NOT FOUND THEN
        v_balance_before := 0;
        v_balance_after := p_quantity;
        INSERT INTO public.inventory (organization_id, product_id, warehouse_id, quantity, updated_at)
        VALUES (p_org_id, p_product_id, p_warehouse_id, v_balance_after, now());
    ELSE
        v_balance_after := v_balance_before + p_quantity;
        UPDATE public.inventory 
        SET quantity = v_balance_after, updated_at = now()
        WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;
    END IF;

    -- Record immutable stock movement
    INSERT INTO public.stock_movements (
        organization_id,
        product_id,
        warehouse_id,
        type,
        quantity,
        balance_before,
        balance_after,
        supplier_id,
        reference_number,
        notes,
        idempotency_key,
        created_by,
        created_at
    ) VALUES (
        p_org_id,
        p_product_id,
        p_warehouse_id,
        'in',
        p_quantity,
        v_balance_before,
        v_balance_after,
        p_supplier_id,
        p_reference_number,
        p_notes,
        p_idempotency_key,
        v_user_id,
        now()
    ) RETURNING id INTO v_movement_id;

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
        'STOCK_IN',
        'inventory',
        v_movement_id,
        jsonb_build_object(
            'product_id', p_product_id,
            'warehouse_id', p_warehouse_id,
            'quantity', p_quantity,
            'balance_before', v_balance_before,
            'balance_after', v_balance_after,
            'reference_number', p_reference_number
        ),
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'movement_id', v_movement_id,
        'balance_before', v_balance_before,
        'balance_after', v_balance_after
    );
END;
$$;


-- Stock Out Function
CREATE OR REPLACE FUNCTION public.process_stock_out(
    p_org_id UUID,
    p_product_id UUID,
    p_warehouse_id UUID,
    p_quantity INTEGER,
    p_purpose TEXT DEFAULT NULL,
    p_reference_number TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_idempotency_key UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role TEXT;
    v_user_id UUID;
    v_balance_before INTEGER;
    v_balance_after INTEGER;
    v_movement_id UUID;
    v_existing_movement RECORD;
    v_product_tracking TEXT;
    v_combined_notes TEXT;
BEGIN
    v_user_id := auth.uid();

    SELECT role INTO v_role FROM public.organization_members 
    WHERE organization_id = p_org_id AND user_id = v_user_id;

    IF v_role IS NULL OR v_role NOT IN ('super_admin', 'admin', 'staff') THEN
        RAISE EXCEPTION 'Unauthorized: User does not have permission to perform stock operations';
    END IF;

    -- Idempotency check
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id, balance_after INTO v_existing_movement 
        FROM public.stock_movements 
        WHERE idempotency_key = p_idempotency_key;
        
        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'movement_id', v_existing_movement.id,
                'balance_after', v_existing_movement.balance_after,
                'is_idempotent_replay', true
            );
        END IF;
    END IF;

    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be greater than zero';
    END IF;

    SELECT tracking_mode INTO v_product_tracking 
    FROM public.products 
    WHERE id = p_product_id AND organization_id = p_org_id AND status = 'active';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found or inactive';
    END IF;

    IF v_product_tracking <> 'bulk' THEN
        RAISE EXCEPTION 'Product tracking mode is not bulk';
    END IF;

    -- Lock and check balance
    SELECT quantity INTO v_balance_before 
    FROM public.inventory 
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id
    FOR UPDATE;

    IF NOT FOUND OR v_balance_before < p_quantity THEN
        RAISE EXCEPTION 'Insufficient stock. Current stock is %, requested %', coalesce(v_balance_before, 0), p_quantity;
    END IF;

    v_balance_after := v_balance_before - p_quantity;
    UPDATE public.inventory 
    SET quantity = v_balance_after, updated_at = now()
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;

    v_combined_notes := trim(both ' ' from concat_ws(' - ', p_purpose, p_notes));

    INSERT INTO public.stock_movements (
        organization_id,
        product_id,
        warehouse_id,
        type,
        quantity,
        balance_before,
        balance_after,
        reference_number,
        notes,
        idempotency_key,
        created_by,
        created_at
    ) VALUES (
        p_org_id,
        p_product_id,
        p_warehouse_id,
        'out',
        p_quantity,
        v_balance_before,
        v_balance_after,
        p_reference_number,
        v_combined_notes,
        p_idempotency_key,
        v_user_id,
        now()
    ) RETURNING id INTO v_movement_id;

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
        'STOCK_OUT',
        'inventory',
        v_movement_id,
        jsonb_build_object(
            'product_id', p_product_id,
            'warehouse_id', p_warehouse_id,
            'quantity', p_quantity,
            'balance_before', v_balance_before,
            'balance_after', v_balance_after,
            'purpose', p_purpose,
            'reference_number', p_reference_number
        ),
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'movement_id', v_movement_id,
        'balance_before', v_balance_before,
        'balance_after', v_balance_after
    );
END;
$$;


-- Stock Adjustment Function
CREATE OR REPLACE FUNCTION public.process_stock_adjustment(
    p_org_id UUID,
    p_product_id UUID,
    p_warehouse_id UUID,
    p_direction TEXT, -- 'in' or 'out'
    p_quantity INTEGER,
    p_reason TEXT,
    p_reference_number TEXT DEFAULT NULL,
    p_idempotency_key UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role TEXT;
    v_user_id UUID;
    v_balance_before INTEGER := 0;
    v_balance_after INTEGER := 0;
    v_movement_id UUID;
    v_movement_type TEXT;
    v_existing_movement RECORD;
BEGIN
    v_user_id := auth.uid();

    SELECT role INTO v_role FROM public.organization_members 
    WHERE organization_id = p_org_id AND user_id = v_user_id;

    IF v_role IS NULL OR v_role NOT IN ('super_admin', 'admin', 'manager') THEN
        RAISE EXCEPTION 'Unauthorized: Only managers and admins can perform stock adjustments';
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
        RAISE EXCEPTION 'A mandatory adjustment reason must be provided';
    END IF;

    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be greater than zero';
    END IF;

    IF p_direction NOT IN ('in', 'out') THEN
        RAISE EXCEPTION 'Invalid adjustment direction. Must be "in" or "out"';
    END IF;

    -- Idempotency check
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id, balance_after INTO v_existing_movement 
        FROM public.stock_movements 
        WHERE idempotency_key = p_idempotency_key;
        
        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'movement_id', v_existing_movement.id,
                'balance_after', v_existing_movement.balance_after,
                'is_idempotent_replay', true
            );
        END IF;
    END IF;

    SELECT quantity INTO v_balance_before 
    FROM public.inventory 
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id
    FOR UPDATE;

    IF p_direction = 'in' THEN
        v_movement_type := 'adjustment_in';
        IF NOT FOUND THEN
            v_balance_before := 0;
            v_balance_after := p_quantity;
            INSERT INTO public.inventory (organization_id, product_id, warehouse_id, quantity, updated_at)
            VALUES (p_org_id, p_product_id, p_warehouse_id, v_balance_after, now());
        ELSE
            v_balance_after := v_balance_before + p_quantity;
            UPDATE public.inventory 
            SET quantity = v_balance_after, updated_at = now()
            WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;
        END IF;
    ELSE
        v_movement_type := 'adjustment_out';
        IF NOT FOUND OR v_balance_before < p_quantity THEN
            RAISE EXCEPTION 'Cannot adjust stock below zero. Current stock: %, requested reduction: %', coalesce(v_balance_before, 0), p_quantity;
        END IF;
        v_balance_after := v_balance_before - p_quantity;
        UPDATE public.inventory 
        SET quantity = v_balance_after, updated_at = now()
        WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;
    END IF;

    INSERT INTO public.stock_movements (
        organization_id,
        product_id,
        warehouse_id,
        type,
        quantity,
        balance_before,
        balance_after,
        reference_number,
        notes,
        idempotency_key,
        created_by,
        created_at
    ) VALUES (
        p_org_id,
        p_product_id,
        p_warehouse_id,
        v_movement_type,
        p_quantity,
        v_balance_before,
        v_balance_after,
        p_reference_number,
        concat('Adjustment: ', p_reason),
        p_idempotency_key,
        v_user_id,
        now()
    ) RETURNING id INTO v_movement_id;

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
        'STOCK_ADJUSTMENT',
        'inventory',
        v_movement_id,
        jsonb_build_object(
            'product_id', p_product_id,
            'warehouse_id', p_warehouse_id,
            'direction', p_direction,
            'quantity', p_quantity,
            'balance_before', v_balance_before,
            'balance_after', v_balance_after,
            'reason', p_reason
        ),
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'movement_id', v_movement_id,
        'balance_before', v_balance_before,
        'balance_after', v_balance_after
    );
END;
$$;
