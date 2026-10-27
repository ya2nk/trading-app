'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CircleDollarSign, Package, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDate } from '@/lib/format';
import { getSupabaseBrowserClient, getSupabaseErrorMessage } from '@/lib/supabase';

type PaymentMethod = 'cash' | 'transfer' | 'card' | 'online';

interface SaleItemRow {
  id: string;
  variant_id: string | null;
  variant_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  product_variants: { stock: number } | { stock: number }[] | null;
}

interface SalePaymentRow {
  id: string;
  amount: number;
  payment_method: PaymentMethod;
  reference: string | null;
  payment_date: string;
}

interface LinkedPurchaseRow {
  id: string;
  supplier_name: string;
  status: string;
  ready_date_estimate: string | null;
}

interface SaleDetail {
  id: string;
  customer_name: string;
  customer_email: string | null;
  total_amount: number;
  status: string;
  sale_date: string;
  customer_ready_date: string | null;
  sale_items: SaleItemRow[];
  sale_payments: SalePaymentRow[];
}

const paymentLabels: Record<PaymentMethod, string> = {
  cash: 'Tunai',
  transfer: 'Transfer',
  card: 'Kartu',
  online: 'Online',
};

function getStock(item: SaleItemRow) {
  const relation = item.product_variants;
  return Array.isArray(relation) ? relation[0]?.stock ?? 0 : relation?.stock ?? 0;
}

export default function SaleDetailPage() {
  const params = useParams<{ id: string }>();
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [linkedPurchases, setLinkedPurchases] = useState<LinkedPurchaseRow[]>([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadSale = useCallback(async () => {
    setLoading(true);
    setError('');
    const supabase = getSupabaseBrowserClient();
    const [{ data, error: queryError }, { data: purchaseData, error: purchaseError }] = await Promise.all([
      supabase.from('sales')
        .select('id, customer_name, customer_email, total_amount, status, sale_date, customer_ready_date, sale_items(id, variant_id, variant_name, sku, quantity, unit_price, subtotal, product_variants(stock)), sale_payments(id, amount, payment_method, reference, payment_date)')
        .eq('id', params.id)
        .maybeSingle(),
      supabase.from('purchases')
        .select('id, supplier_name, status, ready_date_estimate')
        .eq('linked_sale_id', params.id)
        .order('purchase_date', { ascending: false }),
    ]);
    if (queryError) {
      setError(getSupabaseErrorMessage(queryError));
      setSale(null);
    } else {
      const result = data as SaleDetail | null;
      setSale(result);
      if (!result) setError('Pesanan tidak ditemukan atau Anda tidak memiliki akses.');
    }
    if (purchaseError) setError(`Data PO terkait gagal dimuat: ${getSupabaseErrorMessage(purchaseError)}`);
    else setLinkedPurchases((purchaseData ?? []) as LinkedPurchaseRow[]);
    setLoading(false);
  }, [params.id]);

  useEffect(() => { void loadSale(); }, [loadSale]);

  const totalPaid = useMemo(
    () => sale?.sale_payments.reduce((sum, payment) => sum + Number(payment.amount), 0) ?? 0,
    [sale],
  );
  const balance = Math.max(0, Number(sale?.total_amount ?? 0) - totalPaid);
  const canComplete = Boolean(sale?.sale_items.length) &&
    (sale?.sale_items ?? []).every((item) => item.variant_id && getStock(item) >= item.quantity);

  const recordPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sale) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance) {
      setError('Jumlah pembayaran harus lebih dari nol dan tidak boleh melebihi sisa tagihan.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    const { error: paymentError } = await getSupabaseBrowserClient().rpc('record_sale_payment', {
      p_sale_id: sale.id,
      p_amount: amount,
      p_payment_method: paymentMethod,
      p_reference: paymentReference.trim() || null,
    });
    if (paymentError) setError(getSupabaseErrorMessage(paymentError));
    else {
      setNotice('Pembayaran berhasil dicatat dan otomatis masuk ke Keuangan sebagai pemasukan.');
      setPaymentAmount('');
      setPaymentReference('');
    }
    setSaving(false);
    if (!paymentError) await loadSale();
  };

  const completeSale = async () => {
    if (!sale) return;
    setSaving(true);
    setError('');
    setNotice('');
    const { error: updateError } = await getSupabaseBrowserClient()
      .from('sales')
      .update({ status: 'completed' })
      .eq('id', sale.id)
      .eq('status', 'pending');
    if (updateError) setError(getSupabaseErrorMessage(updateError));
    else setNotice('Pesanan selesai dan stok telah diperbarui.');
    setSaving(false);
    if (!updateError) await loadSale();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/sales"><Button variant="outline" size="icon" aria-label="Kembali ke pesanan"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div><h1 className="text-3xl font-bold">Detail Pesanan Customer</h1><p className="mt-1 text-muted-foreground">Pantau pengadaan, kesiapan pesanan, dan pembayaran.</p></div>
      </div>
      {error && <p role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error} <Button variant="outline" size="sm" onClick={() => void loadSale()}>Coba lagi</Button></p>}
      {notice && <p role="status" className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      {loading && <p className="py-10 text-center text-muted-foreground">Memuat pesanan...</p>}
      {!loading && sale && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="font-mono text-sm text-muted-foreground">ORD-{sale.id.slice(0, 8).toUpperCase()}</p><p className="mt-1 text-lg font-semibold">{sale.customer_name}</p><p className="text-sm text-muted-foreground">{sale.customer_email || 'Email tidak tersedia'} · {formatDate(sale.sale_date)}</p></div>
            <Badge variant={sale.status === 'completed' ? 'default' : sale.status === 'pending' ? 'outline' : 'secondary'}>{sale.status === 'completed' ? 'Selesai / diserahkan' : sale.status === 'pending' ? 'Menunggu dipenuhi' : sale.status}</Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Total pesanan</p><p className="mt-1 text-xl font-bold">{formatCurrency(Number(sale.total_amount))}</p></CardContent></Card>
            <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Sudah dibayar</p><p className="mt-1 text-xl font-bold text-green-700">{formatCurrency(totalPaid)}</p></CardContent></Card>
            <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Sisa tagihan</p><p className="mt-1 text-xl font-bold text-amber-700">{formatCurrency(balance)}</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Barang & pemenuhan</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {sale.sale_items.map((item) => {
                const stock = getStock(item);
                const shortfall = Math.max(0, item.quantity - stock);
                return <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                  <div><p className="font-semibold">{item.variant_name}</p><p className="text-sm text-muted-foreground">SKU {item.sku} · {item.quantity} unit · stok saat ini {stock}</p></div>
                  <div className="text-right"><p className="font-medium">{formatCurrency(Number(item.subtotal))}</p>{shortfall > 0 && <p className="text-sm text-amber-700">Kurang {shortfall} unit — perlu PO</p>}</div>
                </div>;
              })}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p className="text-sm text-muted-foreground">Tanggal janji siap customer: {sale.customer_ready_date ? formatDate(`${sale.customer_ready_date}T00:00:00`) : 'Belum ditentukan'}</p>
                {sale.status === 'pending' && <Button disabled={saving || !canComplete} onClick={() => void completeSale()}><Package className="mr-2 h-4 w-4" />Tandai selesai / serahkan</Button>}
              </div>
              {sale.status === 'pending' && !canComplete && <p className="text-sm text-amber-700">Stok belum mencukupi untuk semua item. Terima barang dari PO sebelum menyelesaikan pesanan.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>PO Supplier terkait</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {linkedPurchases.map((purchase) => <Link key={purchase.id} href={`/purchases/${purchase.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 hover:bg-accent/50">
                <span className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /><span><span className="block font-medium">PO-{purchase.id.slice(0, 8).toUpperCase()} · {purchase.supplier_name}</span><span className="text-sm text-muted-foreground">{purchase.ready_date_estimate ? `Estimasi ready supplier ${formatDate(`${purchase.ready_date_estimate}T00:00:00`)}` : 'Tanggal ready belum ditentukan'}</span></span></span>
                <Badge variant={purchase.status === 'completed' ? 'default' : 'outline'}>{purchase.status}</Badge>
              </Link>)}
              {linkedPurchases.length === 0 && <p className="text-sm text-muted-foreground">Belum ada PO yang ditautkan ke pesanan ini.</p>}
              <Link href={`/purchases/new?saleId=${sale.id}`}><Button variant="outline" className="w-full"><Truck className="mr-2 h-4 w-4" />Buat PO untuk pesanan ini</Button></Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Riwayat pembayaran</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              {sale.sale_payments.map((payment) => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0">
                <div><p className="font-medium">{formatCurrency(Number(payment.amount))}</p><p className="text-sm text-muted-foreground">{formatDate(payment.payment_date)} · {paymentLabels[payment.payment_method]}{payment.reference ? ` · ${payment.reference}` : ''}</p></div>
                <Badge variant="secondary">Diterima</Badge>
              </div>)}
              {sale.sale_payments.length === 0 && <p className="text-sm text-muted-foreground">Belum ada pembayaran yang dicatat.</p>}
              {balance > 0 && sale.status !== 'cancelled' && sale.status !== 'refunded' && <form onSubmit={(event) => void recordPayment(event)} className="grid gap-3 border-t pt-5 sm:grid-cols-2">
                <div className="space-y-2"><label htmlFor="payment-amount" className="text-sm font-medium">Jumlah pembayaran / cicilan</label><Input id="payment-amount" type="number" min="1" max={balance} required value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></div>
                <div className="space-y-2"><label htmlFor="payment-method" className="text-sm font-medium">Metode</label><select id="payment-method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="cash">Tunai</option><option value="transfer">Transfer</option><option value="card">Kartu</option><option value="online">Online</option></select></div>
                <div className="space-y-2 sm:col-span-2"><label htmlFor="payment-reference" className="text-sm font-medium">Catatan / referensi (opsional)</label><Input id="payment-reference" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Contoh: DP, cicilan ke-2, nomor referensi transfer" /></div>
                <div className="sm:col-span-2"><Button type="submit" disabled={saving}><CircleDollarSign className="mr-2 h-4 w-4" />Catat pembayaran</Button></div>
              </form>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
