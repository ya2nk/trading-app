'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Grid, List, Package, Plus, Search, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/components/auth-provider';
import { formatCurrency } from '@/lib/format';
import { Product, ProductVariant } from '@/lib/types';
import { getSupabaseBrowserClient, getSupabaseErrorMessage } from '@/lib/supabase';

type ProductRow = Product & { product_variants: ProductVariant[] };

export default function ProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: queryError } = await getSupabaseBrowserClient()
        .from('products')
        .select('*, product_variants(*)')
        .order('created_at', { ascending: false });
      if (queryError) throw queryError;
      setProducts((data ?? []) as ProductRow[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Produk gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadProducts(); }, [loadProducts]);

  const categories = useMemo(() => ['all', ...new Set(products.map((product) => product.category).filter((category): category is string => Boolean(category)))], [products]);
  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) || product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && (categoryFilter === 'all' || product.category === categoryFilter);
  });
  const activeProducts = products.filter((product) => product.is_active).length;
  const inactiveProducts = products.length - activeProducts;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-4xl font-bold">Produk</h1><p className="mt-1 text-muted-foreground">Katalog produk dan varian dari Supabase.</p></div>
        <Link href="/products/new"><Button size="lg" className="gap-2"><Plus className="h-4 w-4" />Tambah Produk</Button></Link>
      </div>
      {error && <div role="alert" className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><span>{getSupabaseErrorMessage({ message: error })}</span><Button variant="outline" size="sm" onClick={() => void loadProducts()}>Coba lagi</Button></div>}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card><CardContent className="flex items-center justify-between p-6"><div><p className="text-sm text-muted-foreground">Total Produk</p><p className="mt-2 text-3xl font-bold">{products.length}</p></div><Package className="h-7 w-7 text-primary" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-6"><div><p className="text-sm text-muted-foreground">Aktif</p><p className="mt-2 text-3xl font-bold text-green-600">{activeProducts}</p></div><TrendingUp className="h-7 w-7 text-green-600" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-6"><div><p className="text-sm text-muted-foreground">Nonaktif</p><p className="mt-2 text-3xl font-bold text-amber-600">{inactiveProducts}</p></div><AlertCircle className="h-7 w-7 text-amber-600" /></CardContent></Card>
      </div>
      <Card><CardContent className="p-4"><div className="flex flex-col gap-4 lg:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-10" placeholder="Cari produk..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div>
        <select aria-label="Filter kategori" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="all">Semua kategori</option>{categories.slice(1).map((category) => <option key={category} value={category}>{category}</option>)}</select>
        <div className="flex gap-2"><Button aria-label="Tampilan grid" variant={viewMode === 'grid' ? 'default' : 'outline'} size="icon" onClick={() => setViewMode('grid')}><Grid className="h-4 w-4" /></Button><Button aria-label="Tampilan daftar" variant={viewMode === 'list' ? 'default' : 'outline'} size="icon" onClick={() => setViewMode('list')}><List className="h-4 w-4" /></Button><Button variant="outline" size="icon" aria-label="Muat ulang" onClick={() => void loadProducts()}>↻</Button></div>
      </div></CardContent></Card>
      {loading ? <p className="py-10 text-center text-muted-foreground">Memuat produk dari Supabase...</p> : filteredProducts.length === 0 ? <div className="py-12 text-center text-muted-foreground"><Package className="mx-auto mb-3 h-12 w-12" /><p>{error ? 'Produk tidak dapat dimuat.' : 'Belum ada produk yang cocok.'}</p></div> : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3' : 'space-y-4'}>
          {filteredProducts.map((product) => {
            const variantCount = product.product_variants?.length ?? 0;
            const stockCount = product.product_variants?.reduce((sum, variant) => sum + variant.stock, 0) ?? 0;
            return <Card key={product.id} className="overflow-hidden">
              <div className="flex h-36 items-center justify-center bg-primary/5"><Package className="h-16 w-16 text-primary/40" /></div>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-2"><h2 className="text-lg font-semibold">{product.name}</h2><Badge variant={product.is_active ? 'secondary' : 'outline'}>{product.is_active ? 'Aktif' : 'Nonaktif'}</Badge></div>
                <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">{product.description || 'Tidak ada deskripsi.'}</p>
                <div className="flex flex-wrap gap-2">{product.category && <Badge variant="secondary">{product.category}</Badge>}{product.sku_prefix && <Badge variant="outline">SKU {product.sku_prefix}</Badge>}</div>
                <div className="flex justify-between border-t pt-3 text-sm"><span className="text-muted-foreground">{variantCount} varian · stok {stockCount}</span><span className="font-semibold text-primary">{formatCurrency(product.base_price ?? 0)}</span></div>
                <Link href={`/products/${product.id}`}><Button variant="outline" className="w-full">Lihat varian</Button></Link>
              </CardContent>
            </Card>;
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Data produk dan stok dibaca langsung dari database Supabase.</p>
    </div>
  );
}
