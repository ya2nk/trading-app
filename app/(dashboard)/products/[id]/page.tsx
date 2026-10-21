'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { Product, ProductVariant } from '@/lib/types';
import { getSupabaseBrowserClient, getSupabaseErrorMessage } from '@/lib/supabase';

type ProductRow = Product & { product_variants: ProductVariant[] };

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<ProductRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProduct = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: queryError } = await getSupabaseBrowserClient()
      .from('products')
      .select('*, product_variants(*)')
      .eq('id', params.id)
      .maybeSingle();
    if (queryError) {
      setProduct(null);
      setError(getSupabaseErrorMessage(queryError));
    } else {
      setProduct((data as ProductRow | null) ?? null);
      if (!data) setError('Produk tidak ditemukan atau Anda tidak memiliki akses.');
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => { void loadProduct(); }, [loadProduct]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4"><Link href="/products"><Button variant="outline" size="icon" aria-label="Kembali"><ArrowLeft className="h-4 w-4" /></Button></Link><div><h1 className="text-3xl font-bold">{product?.name ?? 'Detail Produk'}</h1><p className="mt-1 text-muted-foreground">Informasi dan stok varian dari Supabase.</p></div></div>
      {loading && <p className="py-10 text-center text-muted-foreground">Memuat detail produk...</p>}
      {!loading && error && <div role="alert" className="space-y-3"><p className="text-destructive">{error}</p><Button variant="outline" onClick={() => void loadProduct()}>Coba lagi</Button></div>}
      {!loading && !error && product && <>
        <div className="flex justify-end"><Badge variant={product.is_active ? 'default' : 'secondary'}>{product.is_active ? 'Aktif' : 'Nonaktif'}</Badge></div>
        <Card><CardHeader><CardTitle>Informasi Produk</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-3"><div><p className="text-sm text-muted-foreground">Harga mulai</p><p className="mt-1 font-semibold">{formatCurrency(product.base_price ?? 0)}</p></div><div><p className="text-sm text-muted-foreground">Jumlah varian</p><p className="mt-1 font-semibold">{product.product_variants?.length ?? 0}</p></div><div><p className="text-sm text-muted-foreground">Deskripsi</p><p className="mt-1">{product.description || 'Belum ada deskripsi.'}</p></div></CardContent></Card>
        <Card><CardHeader><CardTitle>Varian & Stok</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-3">Varian</th><th className="p-3">SKU</th><th className="p-3">Harga</th><th className="p-3">Stok</th></tr></thead><tbody>{product.product_variants?.map((variant) => <tr key={variant.id} className="border-b last:border-0"><td className="p-3 font-medium"><Package className="mr-2 inline h-4 w-4 text-muted-foreground" />{variant.name}</td><td className="p-3 font-mono">{variant.sku}</td><td className="p-3">{formatCurrency(variant.price)}</td><td className="p-3">{variant.stock}</td></tr>)}</tbody></table>{!product.product_variants?.length && <p className="py-6 text-center text-muted-foreground">Belum ada varian.</p>}</div></CardContent></Card>
      </>}
    </div>
  );
}
