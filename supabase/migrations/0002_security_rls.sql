-- 0002_security_rls.sql
-- Row Level Security (RLS) Policies and Helper Functions

-- Helper functions
CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
RETURNS TABLE(org_id UUID) 
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(target_org_id UUID)
RETURNS TEXT 
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT role FROM public.organization_members 
    WHERE organization_id = target_org_id AND user_id = auth.uid()
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(target_org_id UUID)
RETURNS BOOLEAN 
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members 
        WHERE organization_id = target_org_id AND user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(target_org_id UUID)
RETURNS BOOLEAN 
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members 
        WHERE organization_id = target_org_id 
          AND user_id = auth.uid() 
          AND role IN ('super_admin', 'admin')
    );
$$;

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Organizations Policies
CREATE POLICY "Users can view organizations they belong to"
ON public.organizations FOR SELECT
USING (id IN (SELECT org_id FROM public.get_user_organization_ids()));

CREATE POLICY "Super admins can update their organization"
ON public.organizations FOR UPDATE
USING (public.get_user_role(id) = 'super_admin');

CREATE POLICY "Authenticated users can create an organization"
ON public.organizations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Profiles Policies
CREATE POLICY "Users can view profiles in their organizations"
ON public.profiles FOR SELECT
USING (
    id = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM public.organization_members om1
        JOIN public.organization_members om2 ON om1.organization_id = om2.organization_id
        WHERE om1.user_id = auth.uid() AND om2.user_id = public.profiles.id
    )
);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (id = auth.uid());

-- 3. Organization Members Policies
CREATE POLICY "Members can view other members in same organization"
ON public.organization_members FOR SELECT
USING (public.is_org_member(organization_id));

CREATE POLICY "Admins can manage organization members"
ON public.organization_members FOR ALL
USING (public.is_org_admin(organization_id))
WITH CHECK (public.is_org_admin(organization_id));

CREATE POLICY "Users can add their initial membership upon creating org"
ON public.organization_members FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Macro helper for standard multi-tenant tables
-- (categories, suppliers, warehouses, locations, products, employees)

-- Categories
CREATE POLICY "Members view categories" ON public.categories FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL USING (public.is_org_admin(organization_id)) WITH CHECK (public.is_org_admin(organization_id));

-- Suppliers
CREATE POLICY "Members view suppliers" ON public.suppliers FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Admins manage suppliers" ON public.suppliers FOR ALL USING (public.is_org_admin(organization_id)) WITH CHECK (public.is_org_admin(organization_id));

-- Warehouses
CREATE POLICY "Members view warehouses" ON public.warehouses FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Admins manage warehouses" ON public.warehouses FOR ALL USING (public.is_org_admin(organization_id)) WITH CHECK (public.is_org_admin(organization_id));

-- Locations
CREATE POLICY "Members view locations" ON public.locations FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Admins manage locations" ON public.locations FOR ALL USING (public.is_org_admin(organization_id)) WITH CHECK (public.is_org_admin(organization_id));

-- Products
CREATE POLICY "Members view products" ON public.products FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Admins manage products" ON public.products FOR ALL USING (public.is_org_admin(organization_id)) WITH CHECK (public.is_org_admin(organization_id));

-- Inventory
CREATE POLICY "Members view inventory" ON public.inventory FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Admins & Staff update inventory" ON public.inventory FOR ALL 
USING (public.is_org_member(organization_id) AND public.get_user_role(organization_id) IN ('super_admin', 'admin', 'staff'))
WITH CHECK (public.is_org_member(organization_id) AND public.get_user_role(organization_id) IN ('super_admin', 'admin', 'staff'));

-- Employees
CREATE POLICY "Members view employees" ON public.employees FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Admins manage employees" ON public.employees FOR ALL USING (public.is_org_admin(organization_id)) WITH CHECK (public.is_org_admin(organization_id));

-- Assets
CREATE POLICY "Members view assets" ON public.assets FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Admins & Staff manage assets" ON public.assets FOR ALL 
USING (public.is_org_member(organization_id) AND public.get_user_role(organization_id) IN ('super_admin', 'admin', 'staff'))
WITH CHECK (public.is_org_member(organization_id) AND public.get_user_role(organization_id) IN ('super_admin', 'admin', 'staff'));

-- Asset Assignments
CREATE POLICY "Members view asset assignments" ON public.asset_assignments FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Admins & Staff manage assignments" ON public.asset_assignments FOR ALL 
USING (public.is_org_member(organization_id) AND public.get_user_role(organization_id) IN ('super_admin', 'admin', 'staff'))
WITH CHECK (public.is_org_member(organization_id) AND public.get_user_role(organization_id) IN ('super_admin', 'admin', 'staff'));

-- Maintenance Records
CREATE POLICY "Members view maintenance" ON public.maintenance_records FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Admins & Staff manage maintenance" ON public.maintenance_records FOR ALL 
USING (public.is_org_member(organization_id) AND public.get_user_role(organization_id) IN ('super_admin', 'admin', 'staff'))
WITH CHECK (public.is_org_member(organization_id) AND public.get_user_role(organization_id) IN ('super_admin', 'admin', 'staff'));

-- Stock Movements (Ledger is append-only for authenticated staff/admin, viewable by members)
CREATE POLICY "Members view stock movements" ON public.stock_movements FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Staff and Admins insert stock movements" ON public.stock_movements FOR INSERT 
WITH CHECK (public.is_org_member(organization_id) AND public.get_user_role(organization_id) IN ('super_admin', 'admin', 'staff'));

-- Audit Logs (Read-only for admins and managers, insertable via system/functions)
CREATE POLICY "Admins and Managers view audit logs" ON public.audit_logs FOR SELECT 
USING (public.is_org_member(organization_id) AND public.get_user_role(organization_id) IN ('super_admin', 'admin', 'manager'));
CREATE POLICY "System insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);
