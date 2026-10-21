-- Add customer and supplier master data without rerunning the original schema migration.
-- Safe to run again after a partial application.

create table if not exists public.customers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text,
  phone text,
  address text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text,
  phone text,
  address text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.customers enable row level security;
alter table public.suppliers enable row level security;

drop policy if exists "Users can view own customers" on public.customers;
create policy "Users can view own customers"
  on public.customers for select
  using (created_by = (select auth.uid()) or public.has_role('admin'));

drop policy if exists "Users can create own customers" on public.customers;
create policy "Users can create own customers"
  on public.customers for insert
  with check (created_by = (select auth.uid()));

drop policy if exists "Users can update own customers" on public.customers;
create policy "Users can update own customers"
  on public.customers for update
  using (created_by = (select auth.uid()) or public.has_role('admin'))
  with check (created_by = (select auth.uid()) or public.has_role('admin'));

drop policy if exists "Users can delete own customers" on public.customers;
create policy "Users can delete own customers"
  on public.customers for delete
  using (created_by = (select auth.uid()) or public.has_role('admin'));

drop policy if exists "Users can view own suppliers" on public.suppliers;
create policy "Users can view own suppliers"
  on public.suppliers for select
  using (created_by = (select auth.uid()) or public.has_role('admin'));

drop policy if exists "Users can create own suppliers" on public.suppliers;
create policy "Users can create own suppliers"
  on public.suppliers for insert
  with check (created_by = (select auth.uid()));

drop policy if exists "Users can update own suppliers" on public.suppliers;
create policy "Users can update own suppliers"
  on public.suppliers for update
  using (created_by = (select auth.uid()) or public.has_role('admin'))
  with check (created_by = (select auth.uid()) or public.has_role('admin'));

drop policy if exists "Users can delete own suppliers" on public.suppliers;
create policy "Users can delete own suppliers"
  on public.suppliers for delete
  using (created_by = (select auth.uid()) or public.has_role('admin'));

create unique index if not exists idx_customers_owner_name
  on public.customers (created_by, lower(name))
  where created_by is not null;
create unique index if not exists idx_suppliers_owner_name
  on public.suppliers (created_by, lower(name))
  where created_by is not null;

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
  before update on public.customers
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_suppliers_updated_at on public.suppliers;
create trigger set_suppliers_updated_at
  before update on public.suppliers
  for each row execute procedure public.set_updated_at();

alter table public.sales
  add column if not exists customer_id uuid references public.customers(id) on delete set null;
alter table public.purchases
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

create index if not exists idx_sales_customer_id on public.sales(customer_id);
create index if not exists idx_purchases_supplier_id on public.purchases(supplier_id);

-- Seed master records from existing transaction snapshots and attach the history.
insert into public.customers (name, email, phone, created_by)
select distinct on (s.created_by, lower(btrim(s.customer_name)))
  btrim(s.customer_name), s.customer_email, s.customer_phone, s.created_by
from public.sales s
where s.created_by is not null and nullif(btrim(s.customer_name), '') is not null
  and not exists (
    select 1 from public.customers c
    where c.created_by = s.created_by
      and lower(btrim(c.name)) = lower(btrim(s.customer_name))
  )
order by s.created_by, lower(btrim(s.customer_name)), s.sale_date desc;

insert into public.suppliers (name, phone, address, created_by)
select distinct on (p.created_by, lower(btrim(p.supplier_name)))
  btrim(p.supplier_name), p.supplier_contact, p.supplier_address, p.created_by
from public.purchases p
where p.created_by is not null and nullif(btrim(p.supplier_name), '') is not null
  and not exists (
    select 1 from public.suppliers s
    where s.created_by = p.created_by
      and lower(btrim(s.name)) = lower(btrim(p.supplier_name))
  )
order by p.created_by, lower(btrim(p.supplier_name)), p.purchase_date desc;

update public.sales s
set customer_id = c.id
from public.customers c
where s.customer_id is null
  and s.created_by = c.created_by
  and lower(btrim(s.customer_name)) = lower(btrim(c.name));

update public.purchases p
set supplier_id = s.id
from public.suppliers s
where p.supplier_id is null
  and p.created_by = s.created_by
  and lower(btrim(p.supplier_name)) = lower(btrim(s.name));
