'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Info, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/format';
import { Product, ProductVariant } from '@/lib/types';
import { useAuth } from '@/components/auth-provider';
import { getSupabaseBrowserClient, getSupabaseErrorMessage } from '@/lib/supabase';

type ProductRow = Product & { product_variants: ProductVariant[] };
interface CartItem {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  attributes: Record<string, string>;
  stock: number;
}

interface CustomerOption {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export default function NewSalePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card' | 'online'>('cash');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    const supabase = getSupabaseBrowserClient();
    const [{ data, error: queryError }, { data: customerData, error: customerError }] = await Promise.all([
      supabase
      .from('products')
      .select('id, name, category, base_price, product_variants(*)')
      .eq('is_active', true)
      .order('name'),
      supabase.from('customers').select('id, name, email, phone').eq('is_active', true).order('name'),
    ]);
    if (queryError) setError(getSupabaseErrorMessage(queryError));
    else setProducts((data ?? []) as ProductRow[]);
    if (customerError) setError(`Data customer gagal dimuat: ${getSupabaseErrorMessage(customerError)}`);
    else setCustomers((customerData ?? []) as CustomerOption[]);
    setLoading(false);
  }, []);

  useEffect(() => { void loadProducts(); }, [loadProducts]);

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0), [cart]);
  const selectedProduct = products.find((product) => product.id === selectedProductId);

  const addToCart = (product: ProductRow, variant: ProductVariant) => {
    setError('');
    const existing = cart.find((item) => item.variantId === variant.id);
    if (existing) {
      if (existing.quantity >= variant.stock) {
        setError(`Stok ${variant.name} tidak mencukupi.`);
        return;
      }
      setCart(cart.map((item) => item.variantId === variant.id ? { ...item, quantity: item.quantity + 1 } : item));
      return;
    }
    if (variant.stock < 1) {
      setError(`Stok ${variant.name} sedang habis.`);
      return;
    }
    setCart([...cart, {
      productId: product.id,
      variantId: variant.id,
      productName: product.name,
      variantName: variant.name,
      sku: variant.sku,
      quantity: 1,
      unitPrice: Number(variant.price),
      attributes: variant.attributes ?? {},
      stock: variant.stock,
    }]);
  };

  const updateQuantity = (variantId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((current) => current.filter((item) => item.variantId !== variantId));
      return;
    }
    setCart((current) => current.map((item) => item.variantId === variantId ? { ...item, quantity: Math.min(quantity, item.stock) } : item));
  };

  const submitSale = async () => {
    if (!user) {
      setError('Silakan masuk dengan akun Supabase sebelum membuat transaksi.');
      return;
    }
    if (!customerName.trim() || cart.length === 0) {
      setError('Isi nama pelanggan dan tambahkan setidaknya satu varian ke keranjang.');
      return;
    }
    setSaving(true);
    setError('');
    const supabase = getSupabaseBrowserClient();
    const { data: sale, error: saleError } = await supabase.from('sales').insert({
      customer_id: customerId || null,
      customer_name: customerName.trim(),
      customer_email: customerEmail.trim() || null,
      total_amount: subtotal,
      payment_method: paymentMethod,
      status: 'pending',
      created_by: user.id,
    }).select('id').single();

    if (saleError) {
      setError(getSupabaseErrorMessage(saleError));
      setSaving(false);
      return;
    }

    const { error: itemsError } = await supabase.from('sale_items').insert(cart.map((item) => ({
      sale_id: sale.id,
      product_id: item.productId,
      variant_id: item.variantId,
      variant_name: item.variantName,
      variant_attributes: item.attributes,
      sku: item.sku,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      subtotal: item.unitPrice * item.quantity,
    })));
    if (itemsError) {
      setError(`Transaksi ${sale.id} tersimpan sebagai pending, tetapi item gagal disimpan: ${getSupabaseErrorMessage(itemsError)} Hapus atau perbaiki transaksi pending tersebut sebelum mencoba lagi.`);
      setSaving(false);
      return;
    }

    const { error: completeError } = await supabase.from('sales').update({ status: 'completed' }).eq('id', sale.id);
    if (completeError) {
      setError(`Item transaksi tersimpan, tetapi transaksi ${sale.id} belum selesai sehingga stok belum diperbarui: ${getSupabaseErrorMessage(completeError)}`);
      setSaving(false);
      return;
    }
    router.push('/sales');
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4"><Link href="/sales"><Button variant="outline" size="icon" aria-label="Kembali ke penjualan"><ArrowLeft className="h-4 w-4" /></Button></Link><div><h1 className="text-3xl font-bold">Penjualan Baru</h1><p className="mt-1 text-muted-foreground">Simpan transaksi dan kurangi stok melalui trigger Supabase.</p></div></div>
      <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><Info className="h-5 w-5 shrink-0" /><p>Transaksi selesai akan mengurangi stok varian. Pastikan stok produk sudah tersedia.</p></div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card><CardContent className="p-6"><h2 className="mb-4 text-xl font-semibold">Pilih Produk & Varian</h2><div className="relative mb-4"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-10" placeholder="Cari produk..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div>
          <div className="max-h-[520px] space-y-3 overflow-y-auto">{loading && <p className="py-6 text-center text-muted-foreground">Memuat produk...</p>}{!loading && filteredProducts.map((product) => <div key={product.id}><button type="button" onClick={() => setSelectedProductId(selectedProductId === product.id ? '' : product.id)} className={`w-full rounded-lg border p-4 text-left ${selectedProductId === product.id ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'}`}><span className="flex justify-between gap-2"><span><span className="block font-semibold">{product.name}</span><span className="text-sm text-muted-foreground">{product.category}</span></span><span className="font-medium text-primary">{formatCurrency(product.base_price ?? 0)}</span></span></button>
            {selectedProductId === product.id && <div className="ml-4 mt-2 space-y-2">{product.product_variants?.filter((variant) => variant.is_active).map((variant) => <button type="button" key={variant.id} onClick={() => addToCart(product, variant)} disabled={variant.stock < 1} className="flex w-full items-center justify-between rounded-lg border p-3 text-left disabled:cursor-not-allowed disabled:opacity-50"><span><span className="block font-medium">{variant.name}</span><span className="text-xs text-muted-foreground">SKU {variant.sku} · Stok {variant.stock}</span></span><span className="font-semibold text-primary">{formatCurrency(Number(variant.price))}</span></button>)}</div>}
          </div>)}
          {!loading && filteredProducts.length === 0 && <p className="py-6 text-center text-muted-foreground">Tidak ada produk aktif yang cocok.</p>}
        </div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="mb-5 flex items-center gap-3"><ShoppingCart className="h-6 w-6 text-primary" /><h2 className="text-xl font-semibold">Keranjang ({cart.length})</h2></div>
          <div className="mb-4 space-y-2"><label htmlFor="customer-select" className="text-sm font-medium">Pilih customer terdaftar (opsional)</label><select id="customer-select" value={customerId} onChange={(event) => { const customer = customers.find((item) => item.id === event.target.value); setCustomerId(customer?.id ?? ''); if (customer) { setCustomerName(customer.name); setCustomerEmail(customer.email ?? ''); } }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Customer baru / tanpa master</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select><p className="text-xs text-muted-foreground">Kelola daftar di menu Customers.</p></div>
          <div className="mb-4 space-y-2"><label htmlFor="customer-name" className="text-sm font-medium">Nama pelanggan</label><Input id="customer-name" required value={customerName} onChange={(event) => { setCustomerId(''); setCustomerName(event.target.value); }} /></div>
          <div className="mb-4 space-y-2"><label htmlFor="customer-email" className="text-sm font-medium">Email pelanggan (opsional)</label><Input id="customer-email" type="email" value={customerEmail} onChange={(event) => { setCustomerId(''); setCustomerEmail(event.target.value); }} /></div>
          <div className="mb-5 space-y-2"><label htmlFor="payment-method" className="text-sm font-medium">Metode pembayaran</label><select id="payment-method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="cash">Tunai</option><option value="transfer">Transfer</option><option value="card">Kartu</option><option value="online">Online</option></select></div>
          <div className="mb-5 max-h-[320px] space-y-3 overflow-y-auto">{cart.length === 0 ? <div className="py-8 text-center text-muted-foreground"><ShoppingCart className="mx-auto mb-3 h-10 w-10" />Belum ada item.</div> : cart.map((item) => <div key={item.variantId} className="space-y-3 rounded-lg border p-4"><div className="flex justify-between gap-2"><div><p className="font-semibold">{item.productName}</p><p className="text-sm text-muted-foreground">{item.variantName} · {item.sku}</p></div><p className="font-bold">{formatCurrency(item.unitPrice * item.quantity)}</p></div><div className="flex items-center justify-between"><div className="flex items-center gap-3"><Button type="button" variant="outline" size="sm" onClick={() => updateQuantity(item.variantId, item.quantity - 1)}>-</Button><span>{item.quantity}</span><Button type="button" variant="outline" size="sm" disabled={item.quantity >= item.stock} onClick={() => updateQuantity(item.variantId, item.quantity + 1)}>+</Button><span className="text-xs text-muted-foreground">maks {item.stock}</span></div><Button type="button" variant="ghost" size="sm" aria-label={`Hapus ${item.variantName}`} onClick={() => updateQuantity(item.variantId, 0)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>)}</div>
          <div className="space-y-3 border-t pt-4"><div className="flex justify-between font-bold"><span>Total</span><span className="text-primary">{formatCurrency(subtotal)}</span></div><Button className="w-full" size="lg" disabled={saving || loading || !user} onClick={() => void submitSale()}>{saving ? 'Menyimpan transaksi...' : 'Selesaikan Penjualan'}</Button></div>
          {!user && <p className="mt-3 text-sm text-amber-700">Masuk dengan akun Supabase untuk membuat transaksi. <Link className="underline" href="/login">Masuk</Link></p>}
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        </CardContent></Card>
      </div>
    </div>
  );
}
