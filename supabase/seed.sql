-- seed.sql
-- INVENTORY OS: Sample Demo Seed Data

DO $$
DECLARE
    v_org_id UUID := '11111111-1111-1111-1111-111111111111';
    v_user_id UUID := '22222222-2222-2222-2222-222222222222';
    v_cat_it UUID := '33333333-3333-3333-3333-333333333301';
    v_cat_office UUID := '33333333-3333-3333-3333-333333333302';
    v_cat_furniture UUID := '33333333-3333-3333-3333-333333333303';
    v_wh_main UUID := '44444444-4444-4444-4444-444444444401';
    v_wh_branch UUID := '44444444-4444-4444-4444-444444444402';
    v_loc_storage UUID := '55555555-5555-5555-5555-555555555501';
    v_loc_server UUID := '55555555-5555-5555-5555-555555555502';
    v_supp_tech UUID := '66666666-6666-6666-6666-666666666601';
    v_supp_stationery UUID := '66666666-6666-6666-6666-666666666602';
    v_prod_paper UUID := '77777777-7777-7777-7777-777777777701';
    v_prod_toner UUID := '77777777-7777-7777-7777-777777777702';
    v_prod_laptop UUID := '77777777-7777-7777-7777-777777777703';
    v_prod_monitor UUID := '77777777-7777-7777-7777-777777777704';
    v_prod_chair UUID := '77777777-7777-7777-7777-777777777705';
    v_emp_alex UUID := '88888888-8888-8888-8888-888888888801';
    v_emp_sarah UUID := '88888888-8888-8888-8888-888888888802';
    v_emp_david UUID := '88888888-8888-8888-8888-888888888803';
    v_asset_mac1 UUID := '99999999-9999-9999-9999-999999999901';
    v_asset_mac2 UUID := '99999999-9999-9999-9999-999999999902';
    v_asset_dell1 UUID := '99999999-9999-9999-9999-999999999903';
BEGIN
    -- 1. Demo Organization
    INSERT INTO public.organizations (id, name, slug, address, phone, email)
    VALUES (v_org_id, 'Acme Global Enterprises', 'acme-global', 'One World Trade Center, Suite 4500, New York, NY', '+1 (555) 019-2834', 'ops@acmeglobal.com')
    ON CONFLICT (id) DO NOTHING;

    -- 2. Categories
    INSERT INTO public.categories (id, organization_id, name, description) VALUES
    (v_cat_it, v_org_id, 'IT Equipment', 'Laptops, desktops, monitors, and servers'),
    (v_cat_office, v_org_id, 'Office Supplies', 'Consumables, paper, toner, and writing gear'),
    (v_cat_furniture, v_org_id, 'Furniture & Fixtures', 'Ergonomic chairs, desks, and storage units')
    ON CONFLICT (id) DO NOTHING;

    -- 3. Warehouses & Locations
    INSERT INTO public.warehouses (id, organization_id, name, code, address, description) VALUES
    (v_wh_main, v_org_id, 'Headquarters Main Vault', 'WH-HQ-01', 'Floor B1, Tower A, New York', 'Primary central storage for office supplies and spare equipment'),
    (v_wh_branch, v_org_id, 'West Coast Regional Depot', 'WH-SF-02', '500 Howard St, San Francisco, CA', 'Secondary regional distribution branch')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.locations (id, organization_id, warehouse_id, name, description) VALUES
    (v_loc_storage, v_org_id, v_wh_main, 'Room 101 - General Supplies', 'Storage room for paper reams and stationery'),
    (v_loc_server, v_org_id, v_wh_main, 'Secure Server Rack A4', 'High security area for network assets and spare laptops')
    ON CONFLICT (id) DO NOTHING;

    -- 4. Suppliers
    INSERT INTO public.suppliers (id, organization_id, name, contact_person, email, phone, address, notes) VALUES
    (v_supp_tech, v_org_id, 'NexTech Distribution Inc', 'Marcus Vance', 'marcus.v@nextechsupply.com', '+1 (555) 392-1100', '100 Silicon Way, San Jose, CA', 'Primary vendor for Apple and Dell enterprise hardware'),
    (v_supp_stationery, v_org_id, 'Apex Office Depot', 'Clara Higgins', 'clara@apexoffice.com', '+1 (555) 837-9922', '45 Industrial Pkwy, Chicago, IL', 'Next-day delivery vendor for stationery and consumables')
    ON CONFLICT (id) DO NOTHING;

    -- 5. Products (Bulk & Serialized)
    INSERT INTO public.products (id, organization_id, category_id, name, sku, barcode, description, unit, tracking_mode, purchase_price, selling_price, min_stock, status) VALUES
    (v_prod_paper, v_org_id, v_cat_office, 'A4 Multipurpose Copy Paper 80gsm (Box of 5 Reams)', 'SKU-OFF-001', '899123456001', 'High quality chlorine-free 80gsm white printing paper', 'box', 'bulk', 28.50, 35.00, 15, 'active'),
    (v_prod_toner, v_org_id, v_cat_office, 'HP LaserJet Enterprise Toner Cartridge (Black)', 'SKU-OFF-002', '899123456002', 'High yield genuine replacement cartridge for LaserJet fleet', 'pcs', 'bulk', 115.00, 140.00, 5, 'active'),
    (v_prod_laptop, v_org_id, v_cat_it, 'MacBook Pro 16" M3 Max (36GB / 1TB)', 'SKU-IT-001', '899123456003', 'Primary developer machine for engineering team', 'unit', 'serialized', 3499.00, 3899.00, 2, 'active'),
    (v_prod_monitor, v_org_id, v_cat_it, 'Dell UltraSharp 27" 4K USB-C Monitor (U2723QE)', 'SKU-IT-002', '899123456004', 'IPS Black color-calibrated display with 90W PD', 'unit', 'serialized', 580.00, 650.00, 4, 'active'),
    (v_prod_chair, v_org_id, v_cat_furniture, 'Herman Miller Aeron Ergonomic Chair - Size B', 'SKU-FUR-001', '899123456005', 'Fully adjustable graphite frame ergonomic office chair', 'unit', 'bulk', 1250.00, 1450.00, 3, 'active')
    ON CONFLICT (id) DO NOTHING;

    -- 6. Inventory Balances
    INSERT INTO public.inventory (organization_id, product_id, warehouse_id, quantity) VALUES
    (v_org_id, v_prod_paper, v_wh_main, 85),
    (v_org_id, v_prod_toner, v_wh_main, 12),
    (v_org_id, v_prod_chair, v_wh_main, 8)
    ON CONFLICT (product_id, warehouse_id) DO NOTHING;

    -- 7. Employees
    INSERT INTO public.employees (id, organization_id, employee_code, full_name, department, position, email, phone, status) VALUES
    (v_emp_alex, v_org_id, 'EMP-1001', 'Alexandre Chen', 'Engineering', 'Staff Platform Engineer', 'alex.chen@acmeglobal.com', '+1 (555) 782-9011', 'active'),
    (v_emp_sarah, v_org_id, 'EMP-1002', 'Sarah Jenkins', 'Product Design', 'Lead UX Architect', 'sarah.j@acmeglobal.com', '+1 (555) 782-9012', 'active'),
    (v_emp_david, v_org_id, 'EMP-1003', 'David K. Ross', 'Finance & Ops', 'Operations Director', 'david.ross@acmeglobal.com', '+1 (555) 782-9013', 'active')
    ON CONFLICT (id) DO NOTHING;

    -- 8. Fixed Assets
    INSERT INTO public.assets (id, organization_id, product_id, asset_tag, serial_number, barcode, warehouse_id, location_id, condition, status, purchase_date, purchase_price, warranty_expiration, notes) VALUES
    (v_asset_mac1, v_org_id, v_prod_laptop, 'AST-2024-001', 'C02G8901MD6R', 'AST2024001', v_wh_main, v_loc_server, 'new', 'assigned', '2024-02-15', 3499.00, '2027-02-15', 'Assigned to Alex Chen for Cloud Platform Architecture development'),
    (v_asset_mac2, v_org_id, v_prod_laptop, 'AST-2024-002', 'C02G8902MD6R', 'AST2024002', v_wh_main, v_loc_server, 'good', 'available', '2024-03-01', 3499.00, '2027-03-01', 'Spare developer laptop in IT inventory pool'),
    (v_asset_dell1, v_org_id, v_prod_monitor, 'AST-2024-003', 'CN-0N864K-74445', 'AST2024003', v_wh_main, v_loc_storage, 'good', 'assigned', '2024-01-10', 580.00, '2027-01-10', 'Desk station monitor assigned to Sarah Jenkins')
    ON CONFLICT (id) DO NOTHING;

    -- 9. Asset Assignments
    INSERT INTO public.asset_assignments (organization_id, asset_id, employee_id, assigned_at, expected_return_date, assignment_notes, status) VALUES
    (v_org_id, v_asset_mac1, v_emp_alex, now() - INTERVAL '60 days', '2026-12-31', 'Standard engineering deployment workstation', 'active'),
    (v_org_id, v_asset_dell1, v_emp_sarah, now() - INTERVAL '90 days', '2026-12-31', 'Design workstation 4K external display', 'active')
    ON CONFLICT DO NOTHING;

    -- 10. Sample Stock Movements
    INSERT INTO public.stock_movements (organization_id, product_id, warehouse_id, type, quantity, balance_before, balance_after, supplier_id, reference_number, notes) VALUES
    (v_org_id, v_prod_paper, v_wh_main, 'in', 100, 0, 100, v_supp_stationery, 'PO-2024-0891', 'Initial monthly bulk paper procurement delivery'),
    (v_org_id, v_prod_paper, v_wh_main, 'out', 15, 100, 85, NULL, 'REQ-DEPT-412', 'Dispatched to Finance & Legal dept floor copiers'),
    (v_org_id, v_prod_toner, v_wh_main, 'in', 12, 0, 12, v_supp_stationery, 'PO-2024-0892', 'Quarterly toner replacement inventory stock in');

END $$;
