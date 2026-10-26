'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CalendarClock, PackageCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDate } from '@/lib/format';
import { getSupabaseBrowserClient, getSupabaseErrorMessage } from '@/lib/supabase';

interface PurchaseItemRow {
  id: string;
  variant_name: string;
  sku: string;
  quantity: number;
  quantity_received: number;
  unit_price: number;
  subtotal: number;
}

interface PurchaseDetail {
  id: string;
  supplier_name: string;
  supplier_contact: string | null;
  total_amount: number;
  status: string;
  notes: string | null;
  purchase_date: string;
  ready_date_estimate: string | null;
  ready_date_confirmed: string | null;
  linked_sale_id: string | null;
  purchase_items: PurchaseItemRow[];
}

interface ReceiptLog {
  variant_name: string | null;
  quantity_change: number;
  created_at: string;
}

const statusLabels: Record<string, string> = {
  pending: 'Menunggu supplier',
  ready: 'Siap di supplier',
  partially_received: 'Diterima sebagian',
  completed: 'Diterima lengkap',
  cancelled: 'Dibatalkan',
};

export default function PurchaseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null);
  const [receiptLogs, setReceiptLogs] = useState<ReceiptLog[]>([]);
  const [readyDateEstimate, setReadyDateEstimate] = useState('');
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadPurchase = useCallback(async () => {
    setLoading(true);
    setError('');
    const supabase = getSupabaseBrowserClient();
    const [{ data, error: queryError }, { data: logData, error: logError }] = await Promise.all([
      supabase.from('purchases')
        .select('id, supplier_name, supplier_contact, total_amount, status, notes, purchase_date, ready_date_estimate, ready_date_confirmed, linked_sale_id, purchase_items(id, variant_name, sku, quantity, quantity_received, unit_price, subtotal)')
        .eq('id', params.id)
        .maybeSingle(),
      supabase.from('inventory_logs')
        .select('variant_name, quantity_change, created_at')
        .eq('reference_id', params.id)
        .eq('type', 'purchase')
        .order('created_at', { ascending: false }),
    ]);
    if (queryError) {
      setError(getSupabaseErrorMessage(queryError));
      setPurchase(null);
    } else {
      const result = data as PurchaseDetail | null;
      setPurchase(result);
      setReadyDateEstimate(result?.ready_date_estimate ?? '');
      setReceiveQuantities(Object.fromEntries((result?.purchase_items ?? []).map((item) => [item.id, item.quantity - item.quantity_received])));
      if (!result) setError('PO tidak ditemukan atau Anda tidak memiliki akses.');
    }
    if (logError) setError(`Riwayat penerimaan gagal dimuat: ${getSupabaseErrorMessage(logError)}`);
    else setReceiptLogs((logData ?? []) as ReceiptLog[]);
    setLoading(false);
  }, [params.id]);

  useEffect(() => { void loadPurchase(); }, [loadPurchase]);

  const updateReadyDate = async () => {
    if (!purchase || !readyDateEstimate) return;
    setSaving(true);
    setError('');
    const { error: updateError } = await getSupabaseBrowserClient()
      .from('purchases')
      .update({ ready_date_estimate: readyDateEstimate })
      .eq('id', purchase.id);
    if (updateError) setError(getSupabaseErrorMessage(updateError));
    else setNotice('Estimasi ready di supplier diperbarui.');
    setSaving(false);
    if (!updateError) await loadPurchase();
  };

  const confirmReady = async () => {
    if (!purchase) return;
    setSaving(true);
    setError('');
    const { error: updateError } = await getSupabaseBrowserClient()
      .rpc('confirm_purchase_ready', { p_purchase_id: purchase.id });
    if (updateError) setError(getSupabaseErrorMessage(updateError));
    else setNotice('Supplier mengonfirmasi barang siap. Stok belum berubah; catat penerimaan barang setelah tiba.');
    setSaving(false);
    if (!updateError) await loadPurchase();
  };

  const receiveItem = async (item: PurchaseItemRow) => {
    const quantity = receiveQuantities[item.id] ?? 0;
    if (!purchase || quantity < 1) {
      setError('Masukkan jumlah barang yang diterima lebih dari nol.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    const { error: receiveError } = await getSupabaseBrowserClient().rpc('receive_purchase_item', {
      p_purchase_item_id: item.id,
      p_quantity: quantity,
    });
    if (receiveError) setError(getSupabaseErrorMessage(receiveError));
    else setNotice(`Penerimaan ${quantity} unit berhasil dicatat dan stok diperbarui.`);
    setSaving(false);
    if (!receiveError) await loadPurchase();
  };

  const linkedSaleHref = purchase?.linked_sale_id ? `/sales/${purchase.linked_sale_id}` : '';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/purchases"><Button variant="outline" size="icon" aria-label="Kembali ke PO"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div><h1 className="text-3xl font-bold">Detail PO Supplier</h1><p className="mt-1 text-muted-foreground">Pantau kesiapan di supplier dan catat penerimaan barang.</p></div>
      </div>
      {error && <p role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error} <Button variant="outline" size="sm" onClick={() => void loadPurchase()}>Coba lagi</Button></p>}
      {notice && <p role="status" className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      {loading && <p className="py-10 text-center text-muted-foreground">Memuat PO...</p>}
      {!loading && purchase && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-sm text-muted-foreground">PO-{purchase.id.slice(0, 8).toUpperCase()}</p>
            <Badge variant={purchase.status === 'completed' ? 'default' : 'outline'}>{statusLabels[purchase.status] ?? purchase.status}</Badge>
          </div>
          <Card>
            <CardHeader><CardTitle>Supplier & jadwal ready</CardTitle></CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div><p className="text-sm text-muted-foreground">Supplier</p><p className="font-medium">{purchase.supplier_name}</p><p className="text-sm text-muted-foreground">{purchase.supplier_contact || 'Kontak tidak tersedia'}</p></div>
              <div><p className="text-sm text-muted-foreground">Tanggal PO</p><p className="font-medium">{formatDate(purchase.purchase_date)}</p></div>
              <div className="space-y-2">
                <label htmlFor="ready-date" className="text-sm font-medium">Estimasi barang ready di supplier</label>
                <div className="flex gap-2"><Input id="ready-date" type="date" value={readyDateEstimate} onChange={(event) => setReadyDateEstimate(event.target.value)} disabled={purchase.status === 'completed' || purchase.status === 'cancelled'} /><Button type="button" variant="outline" disabled={saving || !readyDateEstimate || purchase.status === 'completed' || purchase.status === 'cancelled'} onClick={() => void updateReadyDate()}>Simpan</Button></div>
              </div>
              <div><p className="text-sm text-muted-foreground">Konfirmasi ready supplier</p><p className="font-medium">{purchase.ready_date_confirmed ? formatDate(`${purchase.ready_date_confirmed}T00:00:00`) : 'Belum dikonfirmasi'}</p></div>
              {purchase.linked_sale_id && <div className="sm:col-span-2"><Link className="text-sm text-primary underline" href={linkedSaleHref}>Lihat pesanan customer yang ditautkan</Link></div>}
            </CardContent>
          </Card>
          {purchase.status === 'pending' && <Button disabled={saving} onClick={() => void confirmReady()}><CalendarClock className="mr-2 h-4 w-4" />Konfirmasi barang ready di supplier</Button>}
          <Card>
            <CardHeader><CardTitle>Barang PO · {formatCurrency(Number(purchase.total_amount))}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {purchase.purchase_items.map((item) => {
                const outstanding = item.quantity - item.quantity_received;
                const canReceive = ['ready', 'partially_received'].includes(purchase.status) && outstanding > 0;
                return <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
                  <div><p className="font-semibold">{item.variant_name}</p><p className="text-sm text-muted-foreground">SKU {item.sku} · {item.quantity_received} dari {item.quantity} diterima</p><p className="text-sm">{formatCurrency(Number(item.subtotal))}</p></div>
                  {canReceive && <div className="flex items-end gap-2"><div className="space-y-1"><label htmlFor={`receive-${item.id}`} className="text-xs text-muted-foreground">Jumlah diterima</label><Input id={`receive-${item.id}`} type="number" min="1" max={outstanding} value={receiveQuantities[item.id] ?? outstanding} onChange={(event) => setReceiveQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))} className="w-28" /></div><Button disabled={saving} onClick={() => void receiveItem(item)}><PackageCheck className="mr-2 h-4 w-4" />Terima</Button></div>}
                  {outstanding === 0 && <Badge variant="secondary">Lengkap diterima</Badge>}
                </div>;
              })}
              {purchase.purchase_items.length === 0 && <p className="py-5 text-center text-muted-foreground">PO belum memiliki item.</p>}
              <p className="text-xs text-muted-foreground">Tanggal barang tiba dicatat sebagai tanggal penerimaan. Stok bertambah hanya untuk jumlah yang diterima.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Riwayat barang diterima</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {receiptLogs.map((log, index) => <div key={`${log.created_at}-${index}`} className="flex items-center justify-between gap-3 border-b pb-3 last:border-0">
                <div><p className="font-medium">{log.variant_name || 'Barang PO'}</p><p className="text-sm text-muted-foreground">Diterima {formatDate(log.created_at)}</p></div>
                <Badge variant="secondary">+{log.quantity_change} unit</Badge>
              </div>)}
              {receiptLogs.length === 0 && <p className="text-sm text-muted-foreground">Belum ada barang yang diterima dari PO ini.</p>}
            </CardContent>
          </Card>
          {purchase.status === 'completed' && <p className="text-sm text-green-700">Seluruh barang dalam PO sudah diterima.</p>}
        </>
      )}
      <div className="flex justify-end"><Button variant="outline" onClick={() => router.push('/purchases')}>Kembali ke daftar PO</Button></div>
    </div>
  );
}
