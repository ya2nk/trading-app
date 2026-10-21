'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProductVariantBuilder } from '@/components/products/ProductVariantBuilder';
import { useAuth } from '@/components/auth-provider';
import { getSupabaseBrowserClient, getSupabaseErrorMessage } from '@/lib/supabase';

interface DraftVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  attributes: Record<string, string>;
  sort_order: number;
}

export default function NewProductPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [skuPrefix, setSkuPrefix] = useState('');
  const [description, setDescription] = useState('');
  const [variants, setVariants] = useState<DraftVariant[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!user) {
      setError('Silakan masuk terlebih dahulu untuk menyimpan produk.');
      return;
    }
    if (variants.length === 0) {
      setError('Tambahkan setidaknya satu varian produk.');
      return;
    }
    setSaving(true);
    const supabase = getSupabaseBrowserClient();
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        category: category.trim(),
        sku_prefix: skuPrefix.trim().toUpperCase(),
        base_price: Math.min(...variants.map((variant) => variant.price)),
        images: [],
        created_by: user.id,
        is_active: true,
      })
      .select('id')
      .single();

    if (productError) {
      setError(getSupabaseErrorMessage(productError));
      setSaving(false);
      return;
    }

    const { error: variantsError } = await supabase.from('product_variants').insert(
      variants.map((variant) => ({
        id: variant.id,
        product_id: product.id,
        name: variant.name.trim(),
        sku: variant.sku.trim(),
        price: variant.price,
        stock: variant.stock,
        attributes: variant.attributes,
        sort_order: variant.sort_order,
        is_active: true,
      })),
    );

    if (variantsError) {
      const { error: rollbackError } = await supabase.from('products').delete().eq('id', product.id);
      const rollbackMessage = rollbackError
        ? ` Produk utama sudah tersimpan (${product.id}) tetapi varian gagal dibuat dan pembersihan otomatis juga gagal: ${rollbackError.message}`
        : '';
      setError(`${getSupabaseErrorMessage(variantsError)}${rollbackMessage}`);
      setSaving(false);
      return;
    }

    router.push('/products');
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4"><Link href="/products"><Button variant="outline" size="icon" aria-label="Kembali ke produk"><ArrowLeft className="h-4 w-4" /></Button></Link><div><h1 className="text-3xl font-bold">Tambah Produk</h1><p className="mt-1 text-muted-foreground">Produk dan varian akan disimpan ke Supabase.</p></div></div>
      <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><Info className="h-5 w-5 shrink-0" /><p>Perlu masuk dengan akun Supabase untuk menambahkan produk.</p></div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card><CardHeader><CardTitle>Informasi Produk</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="name">Nama produk</Label><Input id="name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Kemeja Flannel" /></div>
          <div className="space-y-2"><Label htmlFor="category">Kategori</Label><Input id="category" required value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Contoh: Pakaian" /></div>
          <div className="space-y-2"><Label htmlFor="sku">Awalan SKU</Label><Input id="sku" required value={skuPrefix} onChange={(event) => setSkuPrefix(event.target.value.toUpperCase())} placeholder="Contoh: FLN" /></div>
          <div className="space-y-2 md:col-span-2"><Label htmlFor="description">Deskripsi</Label><textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Deskripsi singkat produk" /></div>
        </CardContent></Card>
        <Card><CardContent className="p-6"><ProductVariantBuilder skuPrefix={skuPrefix || undefined} onVariantsChange={setVariants} /></CardContent></Card>
        {!authLoading && !user && <p className="text-sm text-amber-700">Anda belum masuk. <Link className="underline" href="/login">Masuk atau buat akun</Link> untuk menyimpan produk.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-3"><Link href="/products"><Button type="button" variant="outline">Batal</Button></Link><Button type="submit" disabled={saving || authLoading}>{saving ? 'Menyimpan...' : 'Simpan Produk'}</Button></div>
      </form>
    </div>
  );
}
