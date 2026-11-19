-- 0005_audit_and_triggers.sql
-- Triggers for timestamps, auth sync, and product protection

-- 1. Timestamp auto-update trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$ 
BEGIN
    CREATE TRIGGER tr_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    CREATE TRIGGER tr_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    CREATE TRIGGER tr_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    CREATE TRIGGER tr_warehouses_updated_at BEFORE UPDATE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    CREATE TRIGGER tr_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    CREATE TRIGGER tr_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    CREATE TRIGGER tr_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    CREATE TRIGGER tr_maintenance_updated_at BEFORE UPDATE ON public.maintenance_records FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. Auth user creation trigger to sync auth.users to public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, avatar_url, created_at, updated_at)
    VALUES (
        NEW.id,
        coalesce(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        NEW.raw_user_meta_data->>'avatar_url',
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Prevent hard deletion of products with history
CREATE OR REPLACE FUNCTION public.prevent_product_hard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.stock_movements WHERE product_id = OLD.id) THEN
        RAISE EXCEPTION 'Cannot delete product: Stock movements exist for this product. Archive the product instead.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.assets WHERE product_id = OLD.id) THEN
        RAISE EXCEPTION 'Cannot delete product: Fixed assets are registered under this product. Archive the product instead.';
    END IF;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tr_prevent_product_hard_delete ON public.products;
CREATE TRIGGER tr_prevent_product_hard_delete
    BEFORE DELETE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.prevent_product_hard_delete();
