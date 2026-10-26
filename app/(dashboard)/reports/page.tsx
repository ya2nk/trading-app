'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Package, ShoppingBag, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { getSupabaseBrowserClient, getSupabaseErrorMessage } from '@/lib/supabase';

interface DailySummary {
  sale_id: string;
  payment_date: string;
  amount: number;
}

const reportLinks = [
  { href: '/sales', label: 'Laporan penjualan', detail: 'Lihat daftar dan status transaksi penjualan.', icon: ShoppingBag },
  { href: '/inventory', label: 'Laporan inventaris', detail: 'Pantau stok dan produk yang perlu di-restock.', icon: Package },
];

export default function ReportsPage() {
  const [days, setDays] = useState<DailySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    const start = new Date();
    start.setDate(start.getDate() - 6);
    const { data, error: queryError } = await getSupabaseBrowserClient()
      .from('sale_payments')
      .select('sale_id, payment_date, amount')
      .gte('payment_date', start.toISOString())
      .order('payment_date', { ascending: true });
    if (queryError) setError(getSupabaseErrorMessage(queryError));
    else setDays((data ?? []) as DailySummary[]);
    setLoading(false);
  }, []);
  useEffect(() => { void loadReport(); }, [loadReport]);

  const totalRevenue = days.reduce((sum, day) => sum + Number(day.amount), 0);
  const totalSales = new Set(days.map((day) => day.sale_id)).size;
  const revenueByDate = days.reduce<Record<string, number>>((result, day) => {
    const date = day.payment_date.slice(0, 10);
    result[date] = (result[date] ?? 0) + Number(day.amount);
    return result;
  }, {});
  const chartDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return { key, revenue: revenueByDate[key] ?? 0 };
  });
  const maxRevenue = Math.max(1, ...chartDays.map((day) => day.revenue));
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold">Laporan</h1><p className="mt-1 text-muted-foreground">Ringkasan pembayaran yang diterima dari Supabase.</p></div>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">{error}</p>}
    <div className="grid gap-4 md:grid-cols-3"><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Pendapatan 7 hari</p><p className="mt-1 text-2xl font-bold">{formatCurrency(totalRevenue)}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Transaksi selesai</p><p className="mt-1 text-2xl font-bold">{totalSales}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Rata-rata transaksi</p><p className="mt-1 text-2xl font-bold">{formatCurrency(totalSales ? totalRevenue / totalSales : 0)}</p></CardContent></Card></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Pembayaran Harian</CardTitle></CardHeader><CardContent>{loading ? <p className="py-8 text-center text-muted-foreground">Memuat laporan...</p> : totalSales === 0 ? <p className="py-8 text-center text-muted-foreground">Belum ada pembayaran yang diterima dalam 7 hari terakhir.</p> : <div className="flex h-64 items-end gap-3">{chartDays.map((day) => <div key={day.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="w-full rounded-t-md bg-primary/80" style={{ height: `${Math.max(day.revenue ? 4 : 0, day.revenue / maxRevenue * 90)}%` }} title={formatCurrency(day.revenue)} /><span className="text-xs text-muted-foreground">{new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(`${day.key}T00:00:00`))}</span></div>)}</div>}</CardContent></Card>
    <div className="grid gap-4 md:grid-cols-2">{reportLinks.map(({ href, label, detail, icon: Icon }) => <Link href={href} key={href}><Card className="h-full hover:border-primary"><CardContent className="flex items-center gap-4 p-5"><span className="rounded-lg bg-primary/10 p-3 text-primary"><Icon className="h-5 w-5" /></span><span><span className="block font-semibold">{label}</span><span className="text-sm text-muted-foreground">{detail}</span></span></CardContent></Card></Link>)}</div>
    <p className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-4 w-4" />Laporan memperhitungkan pembayaran yang benar-benar diterima, termasuk DP dan cicilan.</p>
  </div>;
}
