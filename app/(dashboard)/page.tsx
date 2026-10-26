'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowUpRight, Calendar, DollarSign, Package, ShoppingBag, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/format';
import { getSupabaseBrowserClient, getSupabaseErrorMessage } from '@/lib/supabase';

interface DashboardSale {
  id: string;
  customer_name: string;
  total_amount: number;
  status: string;
  sale_date: string;
  sale_items: { quantity: number }[];
}
interface RevenueDay { day: string; revenue: number; }

export default function DashboardPage() {
  const [sales, setSales] = useState<DashboardSale[]>([]);
  const [revenueDays, setRevenueDays] = useState<RevenueDay[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    const supabase = getSupabaseBrowserClient();
    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);
    const [salesResult, paymentsResult, productsResult, stockResult] = await Promise.all([
      supabase.from('sales').select('id, customer_name, total_amount, status, sale_date, sale_items(quantity)').gte('sale_date', since.toISOString()).order('sale_date', { ascending: false }),
      supabase.from('sale_payments').select('amount, payment_date').gte('payment_date', since.toISOString()),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('product_variants').select('id, stock').lt('stock', 10).eq('is_active', true),
    ]);
    const errors = [salesResult.error, paymentsResult.error, productsResult.error, stockResult.error].filter(Boolean);
    if (errors.length) setError(getSupabaseErrorMessage(errors[0]!));
    if (salesResult.data) setSales(salesResult.data as DashboardSale[]);
    if (!productsResult.error) setProductCount(productsResult.count ?? 0);
    if (stockResult.data) setLowStockCount(stockResult.data.length);

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(since);
      date.setDate(since.getDate() + index);
      return { key: date.toISOString().slice(0, 10), day: new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(date), revenue: 0 };
    });
    for (const payment of paymentsResult.data ?? []) {
      const day = days.find((item) => item.key === payment.payment_date.slice(0, 10));
      if (day) day.revenue += Number(payment.amount);
    }
    setRevenueDays(days);
    setLoading(false);
  }, []);
  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const completedSales = sales.filter((sale) => ['completed', 'paid'].includes(sale.status));
  const revenue = revenueDays.reduce((sum, day) => sum + day.revenue, 0);
  const maxRevenue = Math.max(1, ...revenueDays.map((day) => day.revenue));

  return <div className="space-y-8">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-4xl font-bold">Dashboard</h1><p className="mt-1 text-muted-foreground">Ringkasan 7 hari terakhir dari Supabase.</p></div><div className="flex gap-3"><Button variant="outline" className="gap-2"><Calendar className="h-4 w-4" />7 hari</Button><Link href="/sales/new"><Button className="gap-2"><ShoppingBag className="h-4 w-4" />Penjualan Baru</Button></Link></div></div>
    {error && <div role="alert" className="flex items-center justify-between rounded-lg border border-destructive/30 p-4 text-sm text-destructive"><span>{error}</span><Button variant="outline" size="sm" onClick={() => void loadDashboard()}>Coba lagi</Button></div>}
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard title="Pembayaran Diterima" value={formatCurrency(revenue)} caption="7 hari terakhir" icon={<DollarSign className="h-5 w-5" />} />
      <MetricCard title="Transaksi" value={completedSales.length.toString()} caption="7 hari terakhir" icon={<ShoppingBag className="h-5 w-5" />} />
      <MetricCard title="Produk Aktif" value={productCount.toString()} caption="Dari katalog" icon={<Package className="h-5 w-5" />} />
      <MetricCard title="Stok Menipis" value={lowStockCount.toString()} caption="Stok kurang dari 10" icon={<AlertCircle className="h-5 w-5" />} />
    </div>
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2"><CardHeader><CardTitle>Pendapatan Harian</CardTitle></CardHeader><CardContent>{loading ? <p className="py-8 text-center text-muted-foreground">Memuat data...</p> : <div className="flex h-64 items-end justify-between gap-3 px-2">{revenueDays.map((day) => <div key={day.day} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="group relative w-full rounded-t-md bg-primary/80" style={{ height: `${Math.max(day.revenue ? 4 : 0, day.revenue / maxRevenue * 90)}%` }} title={formatCurrency(day.revenue)}><span className="absolute bottom-full left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white group-hover:block">{formatCurrency(day.revenue)}</span></div><span className="text-xs text-muted-foreground">{day.day}</span></div>)}</div>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Aksi Cepat</CardTitle></CardHeader><CardContent className="space-y-3"><QuickLink href="/sales/new" label="Buat Penjualan" icon={<ShoppingBag className="h-4 w-4" />} /><QuickLink href="/purchases/new" label="Catat Pembelian" icon={<Package className="h-4 w-4" />} /><QuickLink href="/products/new" label="Tambah Produk" icon={<Package className="h-4 w-4" />} /><QuickLink href="/inventory" label="Lihat Inventaris" icon={<ArrowUpRight className="h-4 w-4" />} /></CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>Transaksi Terbaru</CardTitle></CardHeader><CardContent><div className="space-y-3">{sales.slice(0, 5).map((sale) => <div key={sale.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><div className="flex items-center gap-3"><span className="rounded-full bg-primary/10 p-3 text-primary"><Users className="h-5 w-5" /></span><div><p className="font-semibold">{sale.customer_name}</p><p className="text-sm text-muted-foreground">{sale.sale_items.reduce((sum, item) => sum + item.quantity, 0)} item · {formatDate(sale.sale_date)}</p></div></div><div className="text-right"><p className="font-semibold">{formatCurrency(Number(sale.total_amount))}</p><Badge variant={sale.status === 'completed' ? 'default' : sale.status === 'pending' ? 'outline' : 'secondary'}>{sale.status}</Badge></div></div>)}{!loading && sales.length === 0 && <p className="py-6 text-center text-muted-foreground">Belum ada transaksi dalam 7 hari terakhir.</p>}</div></CardContent></Card>
  </div>;
}

function MetricCard({ title, value, caption, icon }: { title: string; value: string; caption: string; icon: React.ReactNode }) {
  return <Card><CardContent className="flex items-center justify-between p-6"><div><p className="text-sm text-muted-foreground">{title}</p><p className="mt-2 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{caption}</p></div><span className="rounded-xl bg-primary/10 p-3 text-primary">{icon}</span></CardContent></Card>;
}

function QuickLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return <Link href={href} className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"><span className="flex items-center gap-2">{icon}{label}</span><ArrowUpRight className="h-4 w-4" /></Link>;
}
