-- ============================================
-- TRADING APP - DATABASE MIGRATION
-- Supabase Setup for Sales & Purchase Application
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- 1. USERS / PROFILES TABLE
-- ============================================
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  avatar_url text,
  role text default 'user' check (role in ('user', 'admin')),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.profiles enable row level security;

-- Policies for profiles
create policy "Users can view own profile"
  on profiles for select
  using ( auth.uid() = id );

create policy "Users can update own profile"
  on profiles for update
  using ( auth.uid() = id );

-- Profile owners must not be able to promote themselves by updating role.
create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and (select auth.uid()) is not null then
    raise exception 'Profile role can only be changed by a trusted server administrator';
  end if;
  return new;
end;
$$;

create trigger prevent_profile_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_profile_role_escalation();

create policy "Users can create profile on signup"
  on profiles for insert
  with check ( auth.uid() = id );

-- Function to create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer set search_path = '';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper used by the row-level security policies below.
create or replace function public.has_role(role_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = role_name
  );
$$;

-- ============================================
-- 2. PRODUCTS TABLE
-- ============================================
create table public.products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text unique,
  description text,
  category text,
  sku_prefix text, -- Prefix untuk SKU varian produk
  images text[], -- Array of image URLs
  base_price numeric(10,2), -- Harga dasar/referensi
  created_by uuid references public.profiles(id) on delete set null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Indexes for products
create index idx_products_category on products(category);
create index idx_products_slug on products(slug);
create index idx_products_active on products(is_active);

alter table public.products enable row level security;

-- Policies for products
create policy "Anyone can view active products"
  on products for select
  using ( is_active = true );

create policy "Admins can view all products"
  on products for select
  using ( public.has_role('admin') );

create policy "Product owners can view all their products"
  on products for select
  using ( auth.uid() = created_by );

create policy "Authenticated users can create products"
  on products for insert
  with check ( auth.uid() = created_by );

create policy "Product owners and admins can update products"
  on products for update
  using ( auth.uid() = created_by or public.has_role('admin') )
  with check ( auth.uid() = created_by or public.has_role('admin') );

create policy "Product owners and admins can delete products"
  on products for delete
  using ( auth.uid() = created_by or public.has_role('admin') );

-- ============================================
-- 2.1 PRODUCT VARIANTS TABLE (Multi-variant support)
-- ============================================
create table public.product_variants (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  name text not null, -- e.g., "Size M", "Color Red"
  sku text not null, -- Unique SKU per variant
  price numeric(10,2) not null check (price >= 0), -- Variant-specific price
  stock integer default 0 check (stock >= 0), -- Stock PER VARIANT
  attributes jsonb, -- {"size": "M", "color": "red"}
  image_url text, -- Optional variant image
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Unique constraints and indexes
create unique index idx_product_variants_sku 
  on public.product_variants(sku);
  
create unique index idx_product_variants_product_name 
  on public.product_variants(product_id, name);
  
create index idx_product_variants_product_id 
  on public.product_variants(product_id);
  
create index idx_product_variants_active 
  on public.product_variants(is_active);

alter table public.product_variants enable row level security;

create policy "Anyone can view active variants for active products"
  on public.product_variants for select
  using (
    is_active = true
    and exists (
      select 1
      from public.products p
      where p.id = product_id
        and p.is_active = true
    )
  );

create policy "Product owners and admins can manage product variants"
  on public.product_variants for all
  using (
    public.has_role('admin')
    or exists (
      select 1
      from public.products p
      where p.id = product_id
        and p.created_by = (select auth.uid())
    )
  )
  with check (
    public.has_role('admin')
    or exists (
      select 1
      from public.products p
      where p.id = product_id
        and p.created_by = (select auth.uid())
    )
  );

-- ============================================
-- 3. SALES TABLE
-- ============================================
create table public.sales (
  id uuid default uuid_generate_v4() primary key,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  total_amount numeric(10,2) not null check (total_amount >= 0),
  status text default 'pending' check (status in ('pending', 'paid', 'completed', 'cancelled', 'refunded')),
  payment_method text check (payment_method in ('cash', 'transfer', 'card', 'online')),
  notes text,
  sale_date timestamp with time zone default timezone('utc'::text, now()),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.sales enable row level security;

-- Policies for sales
create policy "Users can view own sales and all completed"
  on sales for select
  using ( 
    auth.uid() = created_by 
    or status = 'completed' 
    or public.has_role('admin')
  );

create policy "Authenticated users can create sales"
  on sales for insert
  with check ( auth.uid() = created_by );

create policy "Sales creators can update their sales"
  on sales for update
  using ( auth.uid() = created_by );

create policy "Admins can update any sale"
  on sales for update
  using ( public.has_role('admin') );

-- Indexes for sales
create index idx_sales_created_by on sales(created_by);
create index idx_sales_date on sales(sale_date);
create index idx_sales_status on sales(status);

-- ============================================
-- 4. SALE ITEMS TABLE (Updated with variant support)
-- ============================================
create table public.sale_items (
  id uuid default uuid_generate_v4() primary key,
  sale_id uuid references public.sales(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict, -- Link ke variant
  variant_name text not null, -- Store nama varian untuk history
  variant_attributes jsonb, -- Store attributes untuk history
  sku text not null, -- Store SKU untuk history
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  subtotal numeric(10,2) not null check (subtotal >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Indexes
create index idx_sale_items_sale_id on sale_items(sale_id);
create index idx_sale_items_variant_id on sale_items(variant_id);
create index idx_sale_items_product_id on sale_items(product_id);

alter table public.sale_items enable row level security;

-- Policies for sale items
create policy "Sale items inherit sale permissions"
  on sale_items for all
  using ( 
    exists (
      select 1 from sales 
      where sales.id = sale_id 
      and (sales.created_by = auth.uid() or sales.status = 'completed' or public.has_role('admin'))
    )
  );

-- ============================================
-- 5. PURCHASES TABLE
-- ============================================
create table public.purchases (
  id uuid default uuid_generate_v4() primary key,
  supplier_name text not null,
  supplier_contact text,
  supplier_address text,
  total_amount numeric(10,2) not null check (total_amount >= 0),
  status text default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  notes text,
  purchase_date timestamp with time zone default timezone('utc'::text, now()),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.purchases enable row level security;

-- Policies for purchases
create policy "Users can view own purchases"
  on purchases for select
  using ( auth.uid() = created_by );

create policy "Authenticated users can create purchases"
  on purchases for insert
  with check ( auth.uid() = created_by );

create policy "Purchase creators can update their purchases"
  on purchases for update
  using ( auth.uid() = created_by );

-- Indexes for purchases
create index idx_purchases_created_by on purchases(created_by);
create index idx_purchases_date on purchases(purchase_date);
create index idx_purchases_status on purchases(status);

-- ============================================
-- 6. PURCHASE ITEMS TABLE (Updated with variant support)
-- ============================================
create table public.purchase_items (
  id uuid default uuid_generate_v4() primary key,
  purchase_id uuid references public.purchases(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict, -- Link ke variant
  variant_name text not null,
  sku text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  subtotal numeric(10,2) not null check (subtotal >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Indexes
create index idx_purchase_items_purchase_id on purchase_items(purchase_id);
create index idx_purchase_items_variant_id on purchase_items(variant_id);
create index idx_purchase_items_product_id on purchase_items(product_id);

alter table public.purchase_items enable row level security;

-- Policies for purchase items
create policy "Purchase items inherit purchase permissions"
  on purchase_items for all
  using ( 
    exists (
      select 1 from purchases 
      where purchases.id = purchase_id 
      and purchases.created_by = auth.uid()
    )
  );

-- ============================================
-- 7. INVENTORY LOGS TABLE (Updated with variant support)
-- ============================================
create table public.inventory_logs (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade, -- Detail variant
  type text not null check (type in ('sale', 'purchase', 'adjustment', 'return', 'initial')),
  quantity_change integer not null,
  quantity_before integer,
  quantity_after integer,
  reference_type text check (reference_type in ('sale', 'purchase', 'adjustment')),
  reference_id uuid,
  variant_name text,
  sku text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Indexes
create index idx_inventory_logs_variant_id on inventory_logs(variant_id);
create index idx_inventory_logs_product_id on inventory_logs(product_id);
create index idx_inventory_logs_type on inventory_logs(type);
create index idx_inventory_logs_created_at on inventory_logs(created_at);

alter table public.inventory_logs enable row level security;

-- Policies for inventory logs
create policy "Everyone can view inventory logs"
  on inventory_logs for select
  using ( true );

create policy "Auth users can create inventory logs"
  on inventory_logs for insert
  with check ( auth.uid() is not null );

-- ============================================
-- 8. FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Apply updated_at trigger to relevant tables
create trigger set_products_updated_at
  before update on products 
  for each row execute procedure set_updated_at();

create trigger set_sales_updated_at
  before update on sales 
  for each row execute procedure set_updated_at();

create trigger set_purchases_updated_at
  before update on purchases 
  for each row execute procedure set_updated_at();

-- Function to update variant stock when sale is completed.
create or replace function public.update_stock_on_sale_completed()
returns trigger as $$
declare
  v_variant_id uuid;
  v_quantity integer;
  v_stock_after integer;
begin
  for v_variant_id, v_quantity in
    select si.variant_id, sum(si.quantity)::integer
    from public.sale_items si
    where si.sale_id = new.id and si.variant_id is not null
    group by si.variant_id
  loop
    update public.product_variants
    set stock = stock - v_quantity,
        updated_at = timezone('utc'::text, now())
    where id = v_variant_id
      and stock >= v_quantity
    returning stock into v_stock_after;

    if not found then
      raise exception 'Insufficient stock for product variant %', v_variant_id;
    end if;

    insert into public.inventory_logs (
      product_id,
      variant_id,
      type,
      quantity_change,
      quantity_before,
      quantity_after,
      reference_type,
      reference_id,
      variant_name,
      sku,
      created_by
    )
    select
      pv.product_id,
      v_variant_id,
      'sale',
      -v_quantity,
      v_stock_after + v_quantity,
      v_stock_after,
      'sale',
      new.id,
      pv.name,
      pv.sku,
      new.created_by
    from public.product_variants pv
    where pv.id = v_variant_id;
  end loop;

  return new;
end;
$$ language plpgsql security definer set search_path = '';

-- Trigger to update stock when sale is marked as completed
create trigger on_sale_completed
  after update of status on sales
  for each row
  when (new.status = 'completed' and old.status != 'completed')
  execute function update_stock_on_sale_completed();

-- Function to update variant stock when purchase is completed.
create or replace function public.update_stock_on_purchase_completed()
returns trigger as $$
declare
  v_variant_id uuid;
  v_quantity integer;
  v_stock_after integer;
begin
  for v_variant_id, v_quantity in
    select pi.variant_id, sum(pi.quantity)::integer
    from public.purchase_items pi
    where pi.purchase_id = new.id and pi.variant_id is not null
    group by pi.variant_id
  loop
    update public.product_variants
    set stock = stock + v_quantity,
        updated_at = timezone('utc'::text, now())
    where id = v_variant_id
    returning stock into v_stock_after;

    if not found then
      raise exception 'Product variant % does not exist', v_variant_id;
    end if;

    insert into public.inventory_logs (
      product_id,
      variant_id,
      type,
      quantity_change,
      quantity_before,
      quantity_after,
      reference_type,
      reference_id,
      variant_name,
      sku,
      created_by
    )
    select
      pv.product_id,
      v_variant_id,
      'purchase',
      v_quantity,
      v_stock_after - v_quantity,
      v_stock_after,
      'purchase',
      new.id,
      pv.name,
      pv.sku,
      new.created_by
    from public.product_variants pv
    where pv.id = v_variant_id;
  end loop;

  return new;
end;
$$ language plpgsql security definer set search_path = '';

-- Trigger to update stock when purchase is marked as completed
create trigger on_purchase_completed
  after update of status on purchases
  for each row
  when (new.status = 'completed' and old.status != 'completed')
  execute function update_stock_on_purchase_completed();

-- ============================================
-- 9. VIEWS FOR REPORTING
-- ============================================

-- View for daily sales summary
create or replace view public.daily_sales_summary
with (security_invoker = true)
as
select 
  date(sale_date) as sale_date,
  count(*) as total_sales,
  sum(total_amount) as total_revenue,
  avg(total_amount) as avg_transaction_value
from sales
where status in ('completed', 'paid')
group by date(sale_date)
order by sale_date desc;

-- View for top selling products
create or replace view public.top_selling_products
with (security_invoker = true)
as
select 
  p.id,
  p.name,
  p.category,
  sum(si.quantity) as total_quantity_sold,
  sum(si.subtotal) as total_revenue
from products p
join sale_items si on p.id = si.product_id
join sales s on si.sale_id = s.id
where p.is_active = true
  and s.status in ('completed', 'paid')
group by p.id, p.name, p.category
order by total_quantity_sold desc
limit 20;

-- View for low stock products
create or replace view public.low_stock_products
with (security_invoker = true)
as
select 
  p.id as product_id,
  p.name as product_name,
  p.category,
  pv.id as variant_id,
  pv.name as variant_name,
  pv.sku,
  pv.stock,
  pv.price,
  case 
    when pv.stock = 0 then 'Out of Stock'
    when pv.stock < 10 then 'Low Stock'
    else 'In Stock'
  end as stock_status
from public.products p
join public.product_variants pv on pv.product_id = p.id
where pv.stock < 10
  and p.is_active = true
  and pv.is_active = true
order by pv.stock asc;

-- ============================================
-- 10. EXAMPLE DATA (Optional - remove in production)
-- ============================================

-- Insert example categories
comment on column public.products.category is 'Categories: Electronics, Clothing, Food, Home, Sports, Books, Others';

-- Example: Insert a demo product (optional)
/*
insert into public.products (name, description, category, sku_prefix, base_price, images, is_active)
values (
  'Laptop Gaming XYZ',
  'High performance gaming laptop with RTX graphics',
  'Electronics',
  'LAP',
  15000000,
  array['https://your-bucket.supabase.co/storage/v1/object/public/product_images/laptop.jpg'],
  true
);
*/

-- ============================================
-- NOTES:
-- ============================================
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Create storage bucket 'product_images' manually
-- 3. Configure RLS policies according to requirements
-- 4. Remove example data section in production
-- 5. Adjust roles and permissions based on business needs
-- ============================================
