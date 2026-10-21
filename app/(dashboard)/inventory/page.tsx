'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { getSupabaseBrowserClient, getSupabaseErrorMessage } from '@/lib/supabase';

interface InventoryRow {
  id: string;
  name: string;
  sku: string;
  stock: number;
  price: number;
  products: { name: string } | { name: string }[] | null;
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: queryError } = await getSupabaseBrowserClient()
      .from('product_variants')
      .select('id, name, sku, stock, price, products(name)')
      .eq('is_active', true)
      .order('stock');
    if (queryError) setError(getSupabaseErrorMessage(queryError));
    else setInventory((data ?? []) as InventoryRow[]);
    setLoading(false);
  }, []);
  useEffect(() => { void loadInventory(); }, [loadInventory]);

  const lowStock = inventory.filter((item) => item.stock > 0 && item.stock < 10).length;
  const outOfStock = inventory.filter((item) => item.stock === 0).length;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">Inventaris</h1><p className="mt-1 text-muted-foreground">Stok varian langsung dari Supabase.</p></div><Link href="/purchases/new"><Button><ArrowRight className="mr-2 h-4 w-4" />Tambah Stok</Button></Link></div>
    {error && <div role="alert" className="flex items-center justify-between rounded-lg border border-destructive/30 p-4 text-sm text-destructive"><span>{error}</span><Button variant="outline" size="sm" onClick={() => void loadInventory()}>Coba lagi</Button></div>}
    <div className="grid gap-4 md:grid-cols-3"><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Varian terdaftar</p><p className="mt-1 text-2xl font-bold">{inventory.length}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Stok menipis (&lt;10)</p><p className="mt-1 flex items-center gap-2 text-2xl font-bold text-amber-600"><AlertTriangle className="h-5 w-5" />{lowStock}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Habis</p><p className="mt-1 text-2xl font-bold text-red-600">{outOfStock}</p></CardContent></Card></div>
    <Card><CardHeader><CardTitle>Stok Produk</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-3">Produk / Varian</th><th className="p-3">SKU</th><th className="p-3">Harga</th><th className="p-3">Stok</th><th className="p-3">Status</th></tr></thead><tbody>{inventory.map((item) => { const product = Array.isArray(item.products) ? item.products[0] : item.products; return <tr key={item.id} className="border-b last:border-0"><td className="p-3"><p className="font-medium">{product?.name ?? 'Produk'}</p><p className="text-muted-foreground">{item.name}</p></td><td className="p-3 font-mono">{item.sku}</td><td className="p-3">{formatCurrency(Number(item.price))}</td><td className="p-3 font-semibold">{item.stock}</td><td className="p-3"><Badge variant={item.stock === 0 ? 'destructive' : item.stock < 10 ? 'outline' : 'secondary'}>{item.stock === 0 ? 'Habis' : item.stock < 10 ? 'Menipis' : 'Tersedia'}</Badge></td></tr>; })}</tbody></table>{loading && <p className="py-8 text-center text-muted-foreground">Memuat stok...</p>}{!loading && inventory.length === 0 && <div className="py-10 text-center text-muted-foreground"><Package className="mx-auto mb-2 h-8 w-8" />{error ? 'Data inventaris belum dapat dimuat.' : 'Belum ada varian produk.'}</div>}</div></CardContent></Card>
  </div>;
}
