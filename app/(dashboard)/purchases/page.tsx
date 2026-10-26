'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Plus, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/format';
import { getSupabaseBrowserClient, getSupabaseErrorMessage } from '@/lib/supabase';

interface PurchaseRow {
  id: string;
  supplier_name: string;
  total_amount: number;
  status: string;
  purchase_date: string;
  ready_date_estimate: string | null;
  linked_sale_id: string | null;
  purchase_items: { variant_name: string; quantity: number }[];
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadPurchases = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: queryError } = await getSupabaseBrowserClient()
      .from('purchases')
      .select('id, supplier_name, total_amount, status, purchase_date, ready_date_estimate, linked_sale_id, purchase_items(variant_name, quantity)')
      .order('purchase_date', { ascending: false });
    if (queryError) setError(getSupabaseErrorMessage(queryError));
    else setPurchases((data ?? []) as PurchaseRow[]);
    setLoading(false);
  }, []);
  useEffect(() => { void loadPurchases(); }, [loadPurchases]);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">PO Supplier</h1><p className="mt-1 text-muted-foreground">Pantau estimasi barang ready dan penerimaan dari supplier.</p></div><Link href="/purchases/new"><Button><Plus className="mr-2 h-4 w-4" />Buat PO</Button></Link></div>
    {error && <div role="alert" className="flex items-center justify-between rounded-lg border border-destructive/30 p-4 text-sm text-destructive"><span>{error}</span><Button variant="outline" size="sm" onClick={() => void loadPurchases()}>Coba lagi</Button></div>}
    <div className="grid gap-4 md:grid-cols-2"><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Jumlah pesanan</p><p className="mt-1 text-2xl font-bold">{purchases.length}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Total pembelian</p><p className="mt-1 text-2xl font-bold">{formatCurrency(purchases.reduce((sum, item) => sum + Number(item.total_amount), 0))}</p></CardContent></Card></div>
    <Card><CardContent className="p-5"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-3">Nomor PO</th><th className="p-3">Supplier</th><th className="p-3">Barang</th><th className="p-3">Tanggal PO</th><th className="p-3">Estimasi ready supplier</th><th className="p-3">Jumlah</th><th className="p-3">Total</th><th className="p-3">Status</th></tr></thead><tbody>{purchases.map((purchase) => <tr key={purchase.id} className="border-b last:border-0"><td className="p-3 font-medium"><Link className="text-primary underline" href={`/purchases/${purchase.id}`}>{purchase.id.slice(0, 8).toUpperCase()}</Link></td><td className="p-3">{purchase.supplier_name}{purchase.linked_sale_id && <p className="text-xs text-muted-foreground"><Link href={`/sales/${purchase.linked_sale_id}`}>Pesanan customer</Link></p>}</td><td className="p-3">{purchase.purchase_items.map((item) => item.variant_name).join(', ') || '—'}</td><td className="p-3">{formatDate(purchase.purchase_date)}</td><td className="p-3">{purchase.ready_date_estimate ? <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" />{formatDate(`${purchase.ready_date_estimate}T00:00:00`)}</span> : '—'}</td><td className="p-3">{purchase.purchase_items.reduce((sum, item) => sum + item.quantity, 0)}</td><td className="p-3">{formatCurrency(Number(purchase.total_amount))}</td><td className="p-3"><Badge variant={purchase.status === 'completed' ? 'default' : 'outline'}>{purchase.status === 'ready' ? 'Siap di supplier' : purchase.status === 'partially_received' ? 'Diterima sebagian' : purchase.status === 'completed' ? 'Diterima lengkap' : purchase.status === 'pending' ? 'Menunggu supplier' : purchase.status}</Badge></td></tr>)}</tbody></table>{loading && <p className="py-8 text-center text-muted-foreground">Memuat PO...</p>}{!loading && purchases.length === 0 && <div className="py-10 text-center text-muted-foreground"><Truck className="mx-auto mb-2 h-8 w-8" />{error ? 'Data PO belum bisa dimuat.' : 'Belum ada PO.'}</div>}</div></CardContent></Card>
  </div>;
}
