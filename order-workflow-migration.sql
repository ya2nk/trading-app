alter table public.sales
  add column if not exists customer_ready_date date;

alter table public.purchases
  add column if not exists ready_date_estimate date,
  add column if not exists ready_date_confirmed date,
  add column if not exists linked_sale_id uuid references public.sales(id) on delete set null;

alter table public.purchase_items
  add column if not exists quantity_received integer not null default 0;

update public.purchase_items pi
set quantity_received = pi.quantity
from public.purchases p
where p.id = pi.purchase_id
  and p.status = 'completed'
  and pi.quantity_received = 0;

alter table public.purchase_items
  drop constraint if exists purchase_items_quantity_received_check;
alter table public.purchase_items
  add constraint purchase_items_quantity_received_check
  check (quantity_received >= 0 and quantity_received <= quantity);

alter table public.purchases
  drop constraint if exists purchases_status_check;
alter table public.purchases
  add constraint purchases_status_check
  check (status in ('pending', 'ready', 'partially_received', 'completed', 'cancelled'));

create index if not exists idx_purchases_linked_sale_id
  on public.purchases(linked_sale_id);

create table if not exists public.sale_payments (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash', 'transfer', 'card', 'online')),
  reference text,
  received_by uuid references public.profiles(id) on delete set null,
  payment_date timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_sale_payments_sale_id
  on public.sale_payments(sale_id);

alter table public.sale_payments enable row level security;

drop policy if exists "Users can view payments for own sales" on public.sale_payments;
create policy "Users can view payments for own sales"
  on public.sale_payments for select
  to authenticated
  using (
    exists (
      select 1
      from public.sales s
      where s.id = sale_id
        and (s.created_by = (select auth.uid()) or public.has_role('admin'))
    )
  );

create or replace function public.record_sale_payment(
  p_sale_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total numeric(10,2);
  v_paid numeric(10,2);
  v_owner uuid;
  v_payment_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;
  if p_payment_method not in ('cash', 'transfer', 'card', 'online') then
    raise exception 'Unsupported payment method';
  end if;

  select s.total_amount, s.created_by
  into v_total, v_owner
  from public.sales s
  where s.id = p_sale_id
    and s.status not in ('cancelled', 'refunded')
  for update;

  if not found then
    raise exception 'Sale not found or is not payable';
  end if;
  if v_owner is distinct from (select auth.uid())
     and not public.has_role('admin') then
    raise exception 'You are not allowed to record a payment for this sale';
  end if;

  select coalesce(sum(sp.amount), 0)
  into v_paid
  from public.sale_payments sp
  where sp.sale_id = p_sale_id;

  if v_paid + p_amount > v_total then
    raise exception 'Payment exceeds the remaining balance of %', v_total - v_paid;
  end if;

  insert into public.sale_payments (sale_id, amount, payment_method, reference, received_by)
  values (p_sale_id, p_amount, p_payment_method, nullif(btrim(p_reference), ''), (select auth.uid()))
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

revoke all on function public.record_sale_payment(uuid, numeric, text, text) from public;
grant execute on function public.record_sale_payment(uuid, numeric, text, text) to authenticated;

drop trigger if exists on_purchase_completed on public.purchases;

create or replace function public.guard_purchase_status_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and current_setting('app.allow_purchase_status_change', true) is distinct from 'on' then
    raise exception 'Purchase status must be changed through the PO workflow';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_purchase_status_change on public.purchases;
create trigger guard_purchase_status_change
  before update of status on public.purchases
  for each row execute function public.guard_purchase_status_change();

create or replace function public.confirm_purchase_ready(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select p.created_by into v_owner
  from public.purchases p
  where p.id = p_purchase_id and p.status = 'pending'
  for update;

  if not found then
    raise exception 'Pending purchase not found';
  end if;
  if v_owner is distinct from (select auth.uid())
     and not public.has_role('admin') then
    raise exception 'You are not allowed to update this purchase';
  end if;

  perform set_config('app.allow_purchase_status_change', 'on', true);
  update public.purchases
  set status = 'ready',
      ready_date_confirmed = (timezone('Asia/Jakarta', now()))::date
  where id = p_purchase_id;
end;
$$;

revoke all on function public.confirm_purchase_ready(uuid) from public;
grant execute on function public.confirm_purchase_ready(uuid) to authenticated;

create or replace function public.receive_purchase_item(
  p_purchase_item_id uuid,
  p_quantity integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase_id uuid;
  v_variant_id uuid;
  v_product_id uuid;
  v_variant_name text;
  v_sku text;
  v_ordered integer;
  v_received integer;
  v_owner uuid;
  v_status text;
  v_stock_before integer;
  v_stock_after integer;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Received quantity must be greater than zero';
  end if;

  select p.id, p.created_by, p.status
  into v_purchase_id, v_owner, v_status
  from public.purchases p
  join public.purchase_items pi on pi.purchase_id = p.id
  where pi.id = p_purchase_item_id
  for update of p;

  if not found then
    raise exception 'Purchase item not found';
  end if;
  if v_owner is distinct from (select auth.uid())
     and not public.has_role('admin') then
    raise exception 'You are not allowed to receive this purchase';
  end if;
  if v_status not in ('ready', 'partially_received') then
    raise exception 'Supplier must confirm that the goods are ready before receiving them';
  end if;

  select pi.variant_id, pi.product_id, pi.variant_name, pi.sku, pi.quantity, pi.quantity_received
  into v_variant_id, v_product_id, v_variant_name, v_sku, v_ordered, v_received
  from public.purchase_items pi
  where pi.id = p_purchase_item_id
  for update;

  if v_variant_id is null then
    raise exception 'Purchase item is not linked to a product variant';
  end if;
  if v_received + p_quantity > v_ordered then
    raise exception 'Received quantity exceeds the outstanding purchase quantity';
  end if;

  update public.product_variants pv
  set stock = pv.stock + p_quantity,
      updated_at = timezone('utc'::text, now())
  where pv.id = v_variant_id
  returning pv.stock - p_quantity, pv.stock into v_stock_before, v_stock_after;

  if not found then
    raise exception 'Product variant does not exist';
  end if;

  update public.purchase_items pi
  set quantity_received = pi.quantity_received + p_quantity
  where pi.id = p_purchase_item_id;

  insert into public.inventory_logs (
    product_id, variant_id, type, quantity_change, quantity_before, quantity_after,
    reference_type, reference_id, variant_name, sku, created_by
  )
  values (
    v_product_id, v_variant_id, 'purchase', p_quantity, v_stock_before, v_stock_after,
    'purchase', v_purchase_id, v_variant_name, v_sku, (select auth.uid())
  );

  if exists (
    select 1 from public.purchase_items pi
    where pi.purchase_id = v_purchase_id
      and pi.quantity_received < pi.quantity
  ) then
    perform set_config('app.allow_purchase_status_change', 'on', true);
    update public.purchases p set status = 'partially_received' where p.id = v_purchase_id;
  else
    perform set_config('app.allow_purchase_status_change', 'on', true);
    update public.purchases p set status = 'completed' where p.id = v_purchase_id;
  end if;

  return v_stock_after;
end;
$$;

revoke all on function public.receive_purchase_item(uuid, integer) from public;
grant execute on function public.receive_purchase_item(uuid, integer) to authenticated;
