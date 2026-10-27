-- ============================================
-- FINANCE MODULE (pemasukan & pengeluaran)
-- ============================================
-- Jalankan file ini SATU KALI di Supabase SQL Editor,
-- setelah database-migration.sql, customer-supplier-migration.sql,
-- dan order-workflow-migration.sql.
--
-- - finance_transactions: catatan kas manual (mis. ATK, gaji, sewa)
--   maupun otomatis dari pembayaran customer (DP/cicilan).
-- - Setiap baris baru di sale_payments otomatis tercatat sebagai
--   pemasukan lewat trigger sync_sale_payment_to_finance.
-- - Menghapus baris sale_payments ikut menghapus entri
--   keuangan otomatisnya (ON DELETE CASCADE).

create table if not exists public.finance_transactions (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('income', 'expense')),
  category text not null,
  description text not null,
  amount numeric(10,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash', 'transfer', 'card', 'online')),
  transaction_date timestamptz not null default timezone('utc'::text, now()),
  sale_payment_id uuid unique references public.sale_payments(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_finance_type_date
  on public.finance_transactions(type, transaction_date desc);
create index if not exists idx_finance_created_by
  on public.finance_transactions(created_by);

alter table public.finance_transactions enable row level security;

drop policy if exists "Users can view own finance transactions" on public.finance_transactions;
create policy "Users can view own finance transactions"
  on public.finance_transactions for select
  to authenticated
  using (
    created_by = (select auth.uid())
    or public.has_role('admin')
  );

drop policy if exists "Users can create own finance transactions" on public.finance_transactions;
create policy "Users can create own finance transactions"
  on public.finance_transactions for insert
  to authenticated
  with check (created_by = (select auth.uid()));

drop policy if exists "Users can manage own finance transactions" on public.finance_transactions;
create policy "Users can manage own finance transactions"
  on public.finance_transactions for update
  to authenticated
  using (
    created_by = (select auth.uid())
    or public.has_role('admin')
  )
  with check (
    created_by = (select auth.uid())
    or public.has_role('admin')
  );

drop policy if exists "Users can delete own finance transactions" on public.finance_transactions;
create policy "Users can delete own finance transactions"
  on public.finance_transactions for delete
  to authenticated
  using (
    created_by = (select auth.uid())
    or public.has_role('admin')
  );

-- Setiap pembayaran customer (DP/cicilan) otomatis menjadi pemasukan.
create or replace function public.sync_sale_payment_to_finance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_name text;
begin
  select s.customer_name into v_customer_name
  from public.sales s
  where s.id = NEW.sale_id;

  insert into public.finance_transactions (
    type, category, description, amount,
    payment_method, transaction_date, sale_payment_id, created_by
  )
  values (
    'income',
    'Penjualan / Cicilan',
    'Pembayaran customer ' || coalesce(v_customer_name, '-') || ' (' || upper(substring(NEW.sale_id::text, 1, 8)) || ')',
    NEW.amount,
    NEW.payment_method,
    NEW.payment_date,
    NEW.id,
    NEW.received_by
  );

  return NEW;
end;
$$;

drop trigger if exists sync_sale_payment_to_finance on public.sale_payments;
create trigger sync_sale_payment_to_finance
  after insert on public.sale_payments
  for each row execute function public.sync_sale_payment_to_finance();

-- Backfill: catat pembayaran lama yang belum masuk keuangan.
insert into public.finance_transactions (
  type, category, description, amount,
  payment_method, transaction_date, sale_payment_id, created_by
)
select
  'income',
  'Penjualan / Cicilan',
  'Pembayaran customer ' || coalesce(s.customer_name, '-') || ' (' || upper(substring(sp.sale_id::text, 1, 8)) || ')',
  sp.amount,
  sp.payment_method,
  sp.payment_date,
  sp.id,
  sp.received_by
from public.sale_payments sp
join public.sales s on s.id = sp.sale_id
where not exists (
  select 1 from public.finance_transactions ft
  where ft.sale_payment_id = sp.id
);
