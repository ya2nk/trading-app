'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, ShoppingBag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDate } from '@/lib/format';
import { getSupabaseBrowserClient, getSupabaseErrorMessage } from '@/lib/supabase';

interface SaleRow {
  id: string;
  customer_name: string;
  total_amount: number;
  status: string;
  sale_date: string;
  customer_ready_date: string | null;
  sale_items: { quantity: number }[];
  sale_payments: { amount: number }[];
}

export default function SalesPage() {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSales = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: queryError } = await getSupabaseBrowserClient()
      .from('sales')
      .select('id, customer_name, total_amount, status, sale_date, customer_ready_date, sale_items(quantity), sale_payments(amount)')
      .order('sale_date', { ascending: false });
    if (queryError) {
      setError(getSupabaseErrorMessage(queryError));
    } else {
      setSales((data ?? []) as SaleRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadSales(); }, [loadSales]);

  const visibleSales = useMemo(() => sales.filter((sale) =>
    sale.id.toLowerCase().includes(search.toLowerCase()) ||
    sale.customer_name.toLowerCase().includes(search.toLowerCase())
  ), [sales, search]);
  const revenue = sales.reduce((sum, sale) => sum + sale.sale_payments.reduce((paid, payment) => paid + Number(payment.amount), 0), 0);
  const outstanding = sales.filter((sale) => !['cancelled', 'refunded'].includes(sale.status)).reduce((sum, sale) => sum + Math.max(0, Number(sale.total_amount) - sale.sale_payments.reduce((paid, payment) => paid + Number(payment.amount), 0)), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">Penjualan</h1><p className="mt-1 text-muted-foreground">Transaksi penjualan dari Supabase.</p></div><Link href="/sales/new"><Button><Plus className="mr-2 h-4 w-4" />Buat Penjualan</Button></Link></div>
      {error && <div role="alert" className="flex items-center justify-between rounded-lg border border-destructive/30 p-4 text-sm text-destructive"><span>{error}</span><Button variant="outline" size="sm" onClick={() => void loadSales()}>Coba lagi</Button></div>}
      <div className="grid gap-4 md:grid-cols-3"><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Jumlah pesanan</p><p className="mt-1 text-2xl font-bold">{sales.length}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Pembayaran diterima</p><p className="mt-1 text-2xl font-bold">{formatCurrency(revenue)}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Sisa tagihan</p><p className="mt-1 text-2xl font-bold">{formatCurrency(outstanding)}</p></CardContent></Card></div>
      <Card><CardContent className="space-y-4 p-5">
        <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari transaksi atau pelanggan" /></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-3">Pesanan</th><th className="p-3">Pelanggan</th><th className="p-3">Tanggal siap</th><th className="p-3">Item</th><th className="p-3">Total</th><th className="p-3">Dibayar</th><th className="p-3">Sisa</th><th className="p-3">Status</th></tr></thead><tbody>{visibleSales.map((sale) => { const paid = sale.sale_payments.reduce((sum, payment) => sum + Number(payment.amount), 0); return <tr key={sale.id} className="border-b last:border-0"><td className="p-3 font-medium"><Link className="text-primary underline" href={`/sales/${sale.id}`}>{sale.id.slice(0, 8).toUpperCase()}</Link></td><td className="p-3">{sale.customer_name}</td><td className="p-3">{sale.customer_ready_date ? formatDate(`${sale.customer_ready_date}T00:00:00`) : '—'}</td><td className="p-3">{sale.sale_items.reduce((sum, item) => sum + item.quantity, 0)}</td><td className="p-3 font-medium">{formatCurrency(Number(sale.total_amount))}</td><td className="p-3">{formatCurrency(paid)}</td><td className="p-3">{formatCurrency(Math.max(0, Number(sale.total_amount) - paid))}</td><td className="p-3"><Badge variant={sale.status === 'completed' ? 'default' : sale.status === 'pending' ? 'outline' : 'secondary'}>{sale.status === 'completed' ? 'Selesai' : sale.status === 'pending' ? 'Menunggu' : sale.status}</Badge></td></tr>; })}</tbody></table></div>
        {loading && <p className="py-6 text-center text-muted-foreground">Memuat transaksi...</p>}
        {!loading && visibleSales.length === 0 && <div className="py-8 text-center text-muted-foreground"><ShoppingBag className="mx-auto mb-2 h-8 w-8" />{error ? 'Transaksi belum dapat dimuat.' : 'Belum ada transaksi yang cocok.'}</div>}
      </CardContent></Card>
    </div>
  );
}
