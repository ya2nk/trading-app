'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownCircle, ArrowUpCircle, Plus, Search, Trash2, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/auth-provider';
import { formatCurrency, formatDate } from '@/lib/format';
import { getSupabaseBrowserClient, getSupabaseErrorMessage } from '@/lib/supabase';

type FinanceType = 'income' | 'expense';
type PaymentMethod = 'cash' | 'transfer' | 'card' | 'online';

interface FinanceRow {
  id: string;
  type: FinanceType;
  category: string;
  description: string;
  amount: number;
  payment_method: PaymentMethod;
  transaction_date: string;
  sale_payment_id: string | null;
}

const EXPENSE_CATEGORIES = ['ATK & Perlengkapan', 'Gaji & Upah', 'Sewa', 'Listrik & Utilitas', 'Transportasi', 'Operasional', 'Lainnya'];
const INCOME_CATEGORIES = ['Penjualan', 'Jasa', 'Lainnya'];

const methodLabels: Record<PaymentMethod, string> = {
  cash: 'Tunai',
  transfer: 'Transfer',
  card: 'Kartu',
  online: 'Online',
};

function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function FinancePage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<FinanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | FinanceType>('all');

  const [formType, setFormType] = useState<FinanceType>('expense');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [date, setDate] = useState(todayLocal());

  const loadFinance = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: queryError } = await getSupabaseBrowserClient()
      .from('finance_transactions')
      .select('id, type, category, description, amount, payment_method, transaction_date, sale_payment_id')
      .order('transaction_date', { ascending: false });
    if (queryError) setError(getSupabaseErrorMessage(queryError));
    else setRows((data ?? []) as FinanceRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void loadFinance(); }, [loadFinance]);

  useEffect(() => {
    setCategory(formType === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
  }, [formType]);

  const visibleRows = useMemo(() => rows.filter((row) => {
    const matchesType = typeFilter === 'all' || row.type === typeFilter;
    const keyword = search.toLowerCase();
    const matchesSearch = !keyword ||
      row.description.toLowerCase().includes(keyword) ||
      row.category.toLowerCase().includes(keyword);
    return matchesType && matchesSearch;
  }), [rows, typeFilter, search]);

  const totalIncome = rows.filter((row) => row.type === 'income').reduce((sum, row) => sum + Number(row.amount), 0);
  const totalExpense = rows.filter((row) => row.type === 'expense').reduce((sum, row) => sum + Number(row.amount), 0);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      setError('Silakan masuk terlebih dahulu untuk mencatat transaksi keuangan.');
      return;
    }
    const value = Number(amount);
    if (!description.trim() || !Number.isFinite(value) || value <= 0) {
      setError('Isi deskripsi dan jumlah yang valid (lebih dari nol).');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    const { error: insertError } = await getSupabaseBrowserClient().from('finance_transactions').insert({
      type: formType,
      category,
      description: description.trim(),
      amount: value,
      payment_method: method,
      transaction_date: date ? new Date(`${date}T00:00:00`).toISOString() : new Date().toISOString(),
      created_by: user.id,
    });
    if (insertError) {
      setError(getSupabaseErrorMessage(insertError));
    } else {
      setNotice(`${formType === 'income' ? 'Pemasukan' : 'Pengeluaran'} berhasil dicatat.`);
      setDescription('');
      setAmount('');
      await loadFinance();
    }
    setSaving(false);
  };

  const removeRow = async (row: FinanceRow) => {
    if (row.sale_payment_id) return;
    if (!window.confirm(`Hapus "${row.description}"?`)) return;
    setError('');
    setNotice('');
    const { error: deleteError } = await getSupabaseBrowserClient()
      .from('finance_transactions')
      .delete()
      .eq('id', row.id);
    if (deleteError) setError(getSupabaseErrorMessage(deleteError));
    else {
      setNotice('Transaksi berhasil dihapus.');
      await loadFinance();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-4xl font-bold">Keuangan</h1><p className="mt-1 text-muted-foreground">Pemasukan, pengeluaran, dan cicilan customer dari Supabase.</p></div>
      </div>
      {error && <div role="alert" className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><span>{error}</span><Button variant="outline" size="sm" onClick={() => void loadFinance()}>Coba lagi</Button></div>}
      {notice && <p role="status" className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card><CardContent className="flex items-center justify-between p-6"><div><p className="text-sm text-muted-foreground">Total Pemasukan</p><p className="mt-2 text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p></div><ArrowUpCircle className="h-7 w-7 text-green-600" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-6"><div><p className="text-sm text-muted-foreground">Total Pengeluaran</p><p className="mt-2 text-2xl font-bold text-red-600">{formatCurrency(totalExpense)}</p></div><ArrowDownCircle className="h-7 w-7 text-red-600" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-6"><div><p className="text-sm text-muted-foreground">Saldo Kas</p><p className="mt-2 text-2xl font-bold text-primary">{formatCurrency(totalIncome - totalExpense)}</p></div><Wallet className="h-7 w-7 text-primary" /></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Catat Transaksi</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(event) => void submit(event)} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={formType === 'income' ? 'default' : 'outline'} onClick={() => setFormType('income')} className="gap-2"><ArrowUpCircle className="h-4 w-4" />Pemasukan</Button>
                <Button type="button" variant={formType === 'expense' ? 'default' : 'outline'} onClick={() => setFormType('expense')} className="gap-2"><ArrowDownCircle className="h-4 w-4" />Pengeluaran</Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="finance-category">Kategori</Label>
                <select id="finance-category" value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {(formType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="finance-description">Deskripsi</Label>
                <Input id="finance-description" required value={description} onChange={(event) => setDescription(event.target.value)} placeholder={formType === 'expense' ? 'Contoh: Beli ATK kantor' : 'Contoh: Jasa servis'} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="finance-amount">Jumlah (Rp)</Label>
                  <Input id="finance-amount" required type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finance-date">Tanggal</Label>
                  <Input id="finance-date" type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="finance-method">Metode</Label>
                <select id="finance-method" value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="cash">Tunai</option>
                  <option value="transfer">Transfer</option>
                  <option value="card">Kartu</option>
                  <option value="online">Online</option>
                </select>
              </div>
              {!user && <p className="text-sm text-amber-700">Masuk dengan akun Supabase untuk mencatat transaksi. <Link className="underline" href="/login">Masuk</Link></p>}
              <Button type="submit" className="w-full gap-2" disabled={saving || !user}><Plus className="h-4 w-4" />{saving ? 'Menyimpan...' : 'Simpan Transaksi'}</Button>
              <p className="text-xs text-muted-foreground">DP dan cicilan customer tercatat otomatis sebagai pemasukan saat dicatat di detail pesanan.</p>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Riwayat Transaksi</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-10" placeholder="Cari deskripsi atau kategori..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
              <select aria-label="Filter jenis transaksi" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="all">Semua</option>
                <option value="income">Pemasukan</option>
                <option value="expense">Pengeluaran</option>
              </select>
            </div>
            {loading
              ? <p className="py-8 text-center text-muted-foreground">Memuat transaksi keuangan...</p>
              : visibleRows.length === 0
                ? <p className="py-8 text-center text-muted-foreground">Belum ada transaksi yang cocok.</p>
                : <div className="max-h-[560px] space-y-3 overflow-y-auto">
                  {visibleRows.map((row) => (
                    <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full p-2 ${row.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {row.type === 'income' ? <ArrowUpCircle className="h-5 w-5" /> : <ArrowDownCircle className="h-5 w-5" />}
                        </span>
                        <div>
                          <p className="font-semibold">{row.description}</p>
                          <p className="text-sm text-muted-foreground">{row.category} · {formatDate(row.transaction_date)} · {methodLabels[row.payment_method]}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className={`font-bold ${row.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{row.type === 'income' ? '+' : '-'}{formatCurrency(Number(row.amount))}</p>
                          {row.sale_payment_id && <Badge variant="secondary" className="mt-1">Otomatis · cicilan</Badge>}
                        </div>
                        {!row.sale_payment_id && (
                          <Button type="button" variant="ghost" size="icon" aria-label={`Hapus ${row.description}`} onClick={() => void removeRow(row)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
