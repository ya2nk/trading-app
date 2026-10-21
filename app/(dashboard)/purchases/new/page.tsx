'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProductVariant } from '@/lib/types';
import { useAuth } from '@/components/auth-provider';
import { getSupabaseBrowserClient, getSupabaseErrorMessage } from '@/lib/supabase';

interface VariantOption extends ProductVariant {
  product: { id: string; name: string };
}

interface SupplierOption {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export default function NewPurchasePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [variants, setVariants] = useState<VariantOption[]>([]);
  const [variantId, setVariantId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [supplier, setSupplier] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const total = useMemo(() => quantity * unitPrice, [quantity, unitPrice]);

  const loadVariants = useCallback(async () => {
    setLoading(true);
    setError('');
    const supabase = getSupabaseBrowserClient();
    const [{ data, error: queryError }, { data: supplierData, error: supplierError }] = await Promise.all([
      supabase
      .from('product_variants')
      .select('id, product_id, name, sku, price, stock, attributes, image_url, is_active, sort_order, created_at, updated_at, products(id, name)')
      .eq('is_active', true)
      .order('name'),
      supabase.from('suppliers').select('id, name, email, phone, address').eq('is_active', true).order('name'),
    ]);
    if (queryError) setError(getSupabaseErrorMessage(queryError));
    else {
      const result = (data ?? []).map((row) => {
        const productRelation = row.products as unknown as { id: string; name: string } | { id: string; name: string }[] | null;
        const product = Array.isArray(productRelation) ? productRelation[0] : productRelation;
        return product ? { ...row, product } as VariantOption : null;
      }).filter((row): row is VariantOption => row !== null);
      setVariants(result);
    }
    if (supplierError) setError(`Data supplier gagal dimuat: ${getSupabaseErrorMessage(supplierError)}`);
    else setSuppliers((supplierData ?? []) as SupplierOption[]);
    setLoading(false);
  }, []);
  useEffect(() => { void loadVariants(); }, [loadVariants]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const variant = variants.find((item) => item.id === variantId);
    if (!user) { setError('Silakan masuk dengan akun Supabase untuk mencatat pembelian.'); return; }
    if (!variant) { setError('Pilih varian produk yang akan direstock.'); return; }
    setSaving(true);
    setError('');
    const supabase = getSupabaseBrowserClient();
    const { data: purchase, error: purchaseError } = await supabase.from('purchases').insert({
      supplier_id: supplierId || null,
      supplier_name: supplier.trim(),
      supplier_contact: supplierContact.trim() || null,
      total_amount: total,
      status: 'pending',
      created_by: user.id,
    }).select('id').single();
    if (purchaseError) { setError(getSupabaseErrorMessage(purchaseError)); setSaving(false); return; }

    const { error: itemError } = await supabase.from('purchase_items').insert({
      purchase_id: purchase.id,
      product_id: variant.product_id,
      variant_id: variant.id,
      variant_name: variant.name,
      sku: variant.sku,
      quantity,
      unit_price: unitPrice,
      subtotal: total,
    });
    if (itemError) {
      setError(`Pembelian ${purchase.id} tersimpan sebagai pending, tetapi item gagal disimpan: ${getSupabaseErrorMessage(itemError)}`);
      setSaving(false);
      return;
    }

    const { error: completeError } = await supabase.from('purchases').update({ status: 'completed' }).eq('id', purchase.id);
    if (completeError) {
      setError(`Item pembelian tersimpan, tetapi stok belum ditambah karena pembelian ${purchase.id} belum selesai: ${getSupabaseErrorMessage(completeError)}`);
      setSaving(false);
      return;
    }
    router.push('/purchases');
    router.refresh();
  };

  return <div className="mx-auto max-w-3xl space-y-6">
    <div className="flex items-center gap-4"><Link href="/purchases"><Button variant="outline" size="icon" aria-label="Kembali"><ArrowLeft className="h-4 w-4" /></Button></Link><div><h1 className="text-3xl font-bold">Pembelian Baru</h1><p className="mt-1 text-muted-foreground">Selesaikan pembelian untuk menambahkan stok varian.</p></div></div>
    <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><Info className="h-5 w-5 shrink-0" /><p>Stok bertambah otomatis setelah transaksi pembelian berhasil diselesaikan.</p></div>
    <form onSubmit={submit}><Card><CardHeader><CardTitle>Detail Pembelian</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="space-y-2"><Label htmlFor="supplier-select">Pilih supplier terdaftar (opsional)</Label><select id="supplier-select" value={supplierId} onChange={(event) => { const selected = suppliers.find((item) => item.id === event.target.value); setSupplierId(selected?.id ?? ''); if (selected) { setSupplier(selected.name); setSupplierContact(selected.phone ?? selected.email ?? ''); } }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Supplier baru / tanpa master</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><p className="text-xs text-muted-foreground">Kelola daftar di menu Suppliers.</p></div>
      <div className="space-y-2"><Label htmlFor="supplier">Nama pemasok</Label><Input id="supplier" required value={supplier} onChange={(event) => { setSupplierId(''); setSupplier(event.target.value); }} placeholder="Nama pemasok" /></div>
      <div className="space-y-2"><Label htmlFor="contact">Kontak pemasok (opsional)</Label><Input id="contact" value={supplierContact} onChange={(event) => { setSupplierId(''); setSupplierContact(event.target.value); }} placeholder="Email atau nomor telepon" /></div>
      <div className="space-y-2"><Label htmlFor="variant">Produk dan varian</Label><select id="variant" required value={variantId} onChange={(event) => { setVariantId(event.target.value); const variant = variants.find((item) => item.id === event.target.value); if (variant) setUnitPrice(Number(variant.price)); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">{loading ? 'Memuat varian...' : 'Pilih varian'}</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.product.name} · {variant.name} · SKU {variant.sku} · stok {variant.stock}</option>)}</select>{!loading && variants.length === 0 && <p className="text-sm text-muted-foreground">Belum ada varian. Tambahkan produk dan varian terlebih dahulu.</p>}</div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="quantity">Jumlah</Label><Input id="quantity" required type="number" min="1" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} /></div><div className="space-y-2"><Label htmlFor="price">Harga satuan (Rp)</Label><Input id="price" required type="number" min="0" value={unitPrice} onChange={(event) => setUnitPrice(Math.max(0, Number(event.target.value)))} /></div></div>
      <div className="rounded-md bg-muted p-4"><p className="text-sm text-muted-foreground">Total pembelian</p><p className="text-xl font-bold">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(total)}</p></div>
      {!user && <p className="text-sm text-amber-700">Masuk untuk mencatat transaksi. <Link className="underline" href="/login">Masuk atau buat akun</Link></p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-3"><Link href="/purchases"><Button variant="outline" type="button">Batal</Button></Link><Button type="submit" disabled={saving || loading || !user || variants.length === 0}>{saving ? 'Menyimpan...' : 'Simpan & Tambah Stok'}</Button></div>
    </CardContent></Card></form>
  </div>;
}
