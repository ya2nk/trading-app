# Perancangan Aplikasi Trading Platform (Penjualan & Pembelian Barang)

## 1. Gambaran Umum Aplikasi

Trading App adalah platform web untuk mengelola transaksi penjualan dan pembelian barang secara efisien dengan fitur-fitur modern dan scalable.

### **Tech Stack:**
- **Frontend:** Next.js + React + Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Authentication, Storage)
- **Hosting:** Vercel
- **State Management:** Zustand / Context API
- **UI Library:** Shadcn/UI atau Radix UI

---

## 2. Struktur Database Supabase

### **Tabel Utama:**

#### **2.1 Users (Profiles)**
```sql
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  avatar_url text,
  role text default 'user', -- user, admin
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);
```

#### **2.2 Products (Parent Table)**
```sql
create table public.products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text unique,
  description text,
  category text,
  sku_prefix text, -- Prefix untuk SKU varian
  images text[], -- Array of image URLs
  base_price numeric(10,2), -- Harga dasar/referensi
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);
```

#### **2.3 Product Variants (Varian Produk - Support Multi-variant)**
```sql
create table public.product_variants (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  name text not null, -- Contoh: "Size M", "Color Red"
  sku text not null, -- Unique SKU untuk setiap varian
  price numeric(10,2) not null check (price >= 0), -- Harga spesifik varian
  stock integer default 0 check (stock >= 0), -- Stock PER VARIANT
  attributes jsonb, -- { "size": "M", "color": "red" }
  image_url text, -- Optional: gambar khusus variant
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Unique constraints
create unique index idx_product_variants_sku 
  on public.product_variants(sku);
  
create unique index idx_product_variants_product_name 
  on public.product_variants(product_id, name);
```

---

### **2.2 Sales (Transaksi Penjualan - Updated)**
```sql
create table public.sales (

#### **2.3 Sales (Transaksi Penjualan)**
```sql
create table public.sales (
  id uuid default uuid_generate_v4() primary key,
  customer_name text not null,
  customer_email text,
  total_amount numeric(10,2) not null,
  status text default 'pending', -- pending, paid, completed, cancelled
  payment_method text, -- cash, transfer, card
  sale_date timestamp with time zone default timezone('utc'::text, now()),
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now())
);
```

#### **2.4 Sale_Items**
```sql
create table public.sale_items (
  id uuid default uuid_generate_v4() primary key,
  sale_id uuid references public.sales(id) on delete cascade,
  product_id uuid references public.products(id),
  quantity integer not null,
  unit_price numeric(10,2) not null,
  subtotal numeric(10,2) not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
```

#### **2.5 Purchases (Transaksi Pembelian/Restock)**
```sql
create table public.purchases (
  id uuid default uuid_generate_v4() primary key,
  supplier_name text not null,
  supplier_contact text,
  total_amount numeric(10,2) not null,
  status text default 'completed', -- pending, completed, cancelled
  purchase_date timestamp with time zone default timezone('utc'::text, now()),
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now())
);
```

#### **2.6 Purchase_Items**
```sql
create table public.purchase_items (
  id uuid default uuid_generate_v4() primary key,
  purchase_id uuid references public.purchases(id) on delete cascade,
  product_id uuid references public.products(id),
  quantity integer not null,
  unit_price numeric(10,2) not null,
  subtotal numeric(10,2) not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
```

#### **2.7 Inventory_Logs**
```sql
create table public.inventory_logs (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references public.products(id),
  type text not null, -- sale, purchase, adjustment, return
  quantity_change integer not null,
  quantity_before integer,
  quantity_after integer,
  reference_type text, -- sale, purchase
  reference_id uuid,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now())
);
```

---

## 3. Fitur Utama

### **3.1 Authentication & Authorization**
- Login/Register dengan email & password
- OAuth providers (Google, GitHub)
- Role-based access control (User, Admin)
- Protected routes

### **3.2 Product Management**
- CRUD produk
- Upload gambar produk (Supabase Storage)
- Kategori produk
- Filter & pencarian produk
- Stock management

### **3.3 Sales Management**
- Buat transaksi penjualan baru
- Cari produk dan tambah ke cart
- Hitung otomatis total harga
- Export laporan penjualan
- Filter by date/status

### **3.4 Purchase Management**
- Buat transaksi pembelian (restock)
- Input data supplier
- Auto update stok saat purchase/diskon
- Riwayat pembelian

### **3.5 Inventory Management**
- Real-time stock tracking
- Inventory logs (audit trail)
- Low stock alerts
- Stock adjustment

### **3.6 Dashboard & Reports**
- Ringkasan statistik
- Grafik penjualan harian/bulanan
- Top selling products
- Revenue report
- Export PDF/Excel

---

## 4. Struktur Folder Project

```
trading-app/
├── .vercel
├── .supabase
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   │   ├── page.tsx              # Dashboard overview
│   │   ├── products/
│   │   │   ├── page.tsx          # List products
│   │   │   ├── new/
│   │   │   └── [id]/edit/
│   │   ├── sales/
│   │   │   ├── page.tsx          # List sales
│   │   │   ├── new/
│   │   │   └── [id]/details/
│   │   ├── purchases/
│   │   │   ├── page.tsx          # List purchases
│   │   │   ├── new/
│   │   │   └── [id]/details/
│   │   ├── inventory/
│   │   │   └── page.tsx
│   │   ├── reports/
│   │   │   └── page.tsx
│   │   └── settings/
│   ├── api/                      # API Routes (optional, can use Supabase Edge Functions)
│   └── layout.tsx
├── components/
│   ├── ui/                       # UI components (Button, Input, etc.)
│   ├── products/                 # Product-related components
│   ├── sales/                    # Sales-related components
│   ├── purchases/                # Purchase-related components
│   ├── inventory/                # Inventory components
│   ├── dashboard/                # Dashboard widgets
│   └── common/                   # Reusable components
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # Supabase client
│   │   └── server.ts            # Server-side Supabase
│   ├── utils.ts                  # Helper functions
│   └── types.ts                  # TypeScript types
├── stores/                       # Zustand stores
├── hooks/                        # Custom React hooks
├── public/
│   └── images/
├── styles/
│   └── globals.css
├── middleware.ts                 # Auth middleware
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── README.md
```

---

## 5. Halaman & Route Structure

### **Public Pages:**
- `/` - Landing page (optional)
- `/login` - Login page
- `/register` - Register page

### **Protected Pages (Require Auth):**

#### **Dashboard**
- `/dashboard` - Overview dengan statistik & charts

#### **Products**
- `/products` - List all products dengan filter
- `/products/new` - Form create product
- `/products/[id]/edit` - Form edit product
- `/products/[id]` - Product details

#### **Sales**
- `/sales` - List all sales transactions
- `/sales/new` - Create new sale
- `/sales/[id]` - Sale details & invoice
- `/sales/[id]/edit` - Edit sale

#### **Purchases**
- `/purchases` - List all purchase transactions
- `/purchases/new` - Create new purchase
- `/purchases/[id]` - Purchase details
- `/purchases/[id]/edit` - Edit purchase

#### **Inventory**
- `/inventory` - Stock overview dengan low stock alerts
- `/inventory/logs` - Audit trail inventory

#### **Reports**
- `/reports/sales` - Sales report
- `/reports/inventory` - Inventory report
- `/reports/revenue` - Revenue analytics

#### **Settings**
- `/settings/profile` - User profile settings
- `/settings/company` - Company info (for admin)

---

## 6. Supabase Configuration

### **Environment Variables (.env.local):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### **Supabase Storage Buckets:**
```sql
-- Create storage bucket for product images
create bucket public.product_images if not exists;

-- Set up storage policy
create policy "Product images are publicly accessible"
on storage.objects for select
using ( bucket_id = 'product_images' );

create policy "Users can upload product images"
on storage.objects for insert
with check ( bucket_id = 'product_images' );

create policy "Users can update own product images"
on storage.objects for update
using ( bucket_id = 'product_images' );
```

### **RLS Policies (Row Level Security):**

```sql
-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.purchase_items enable row level security;
alter table public.sale_items enable row level security;
alter table public.inventory_logs enable row level security;

-- Profiles: users can view their own profile
create policy "Users can view own profile"
on profiles for select
using ( auth.uid() = id );

-- Products: everyone can view active products
create policy "Anyone can view active products"
on products for select
using ( is_active = true );

-- Products: only authenticated users can create
create policy "Authenticated users can create products"
on products for insert
with check ( auth.uid() = seller_id );

-- Sales: only creators or admins can view/edit/delete
create policy "Users can view own sales"
on sales for select
using ( auth.uid() = created_by or has_role('admin') );
```

---

## 7. Komponen Utama

### **7.1 Layout Components:**
```typescript
// AppLayout.tsx
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';

export default function AppLayout({ children }) {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### **7.2 Product Card Component:**
```typescript
// ProductCard.tsx
export function ProductCard({ product }: { product: Product }) {
  return (
    <Card>
      <CardImage src={product.image_url} alt={product.name} />
      <CardContent>
        <CardTitle>{product.name}</CardTitle>
        <CardDescription>{product.category}</CardDescription>
        <CardPrice>{formatCurrency(product.price)}</CardPrice>
        <CardStock>Stok: {product.stock}</CardStock>
        <CardActions>
          <Button variant="outline">View Details</Button>
          <Button>Edit</Button>
        </CardActions>
      </CardContent>
    </Card>
  );
}
```

### **7.3 Cart Component:**
```typescript
// Cart.tsx
export function Cart() {
  const { items } = useCartStore();
  
  const total = items.reduce((sum, item) => 
    sum + (item.unitPrice * item.quantity), 0
  );

  return (
    <div className="cart">
      {items.map(item => (
        <CartItem key={item.productId} {...item} />
      ))}
      <div className="cart-total">
        Total: {formatCurrency(total)}
        <Button>Add to Cart</Button>
      </div>
    </div>
  );
}
```

---

## 8. State Management (Zustand Store)

```typescript
// stores/cart-store.ts
import { create } from 'zustand';

interface CartItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
}

interface CartStore {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'>) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartStore>((set) => ({
  items: [],
  addToCart: (item) => set((state) => {
    const existing = state.items.find(i => i.productId === item.productId);
    if (existing) {
      return {
        items: state.items.map(i => 
          i.productId === item.productId 
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      };
    }
    return { items: [...state.items, { ...item, quantity: 1 }] };
  }),
  removeFromCart: (productId) => set((state) => ({
    items: state.items.filter(i => i.productId !== productId)
  })),
  updateQuantity: (productId, quantity) => set((state) => ({
    items: state.items.map(i => 
      i.productId === productId ? { ...i, quantity } : i
    )
  })),
  clearCart: () => set({ items: [] })
}));
```

---

## 9. API Integration dengan Supabase

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// examples/product-api.ts
import { createClient } from '@/lib/supabase/client';

export async function getProducts(filters?: {
  category?: string;
  search?: string;
}) {
  const supabase = createClient();
  
  let query = supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (filters?.category) {
    query = query.eq('category', filters.category);
  }
  
  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  const { data, error } = await query;
  
  if (error) throw error;
  return data;
}

export async function createSale(saleData: {
  customerName: string;
  customerEmail?: string;
  saleItems: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  paymentMethod: string;
}) {
  const supabase = createClient();
  const userId = (await supabase.auth.getUser()).data.user?.id;

  // Begin transaction
  const saleResponse = await supabase
    .from('sales')
    .insert({
      customer_name: saleData.customerName,
      customer_email: saleData.customerEmail,
      total_amount: 0, // will be calculated
      status: 'pending',
      created_by: userId,
      payment_method: saleData.paymentMethod
    })
    .select()
    .single();

  if (saleResponse.error) throw saleResponse.error;

  const saleId = saleResponse.data.id;
  
  // Insert sale items and calculate total
  const saleItems = saleData.saleItems.map(item => ({
    sale_id: saleId,
    product_id: item.productId,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    subtotal: item.quantity * item.unitPrice
  }));

  const totalAmount = saleItems.reduce((sum, item) => sum + item.subtotal, 0);
  
  await supabase
    .from('sale_items')
    .insert(saleItems);

  await supabase
    .from('sales')
    .update({ total_amount: totalAmount, status: 'completed' })
    .eq('id', saleId);

  // Update product stock
  for (const item of saleData.saleItems) {
    await updateProductStock(item.productId, -item.quantity);
  }
}
```

---

## 10. Dashboard Metrics & Charts

### **Stats Cards:**
```typescript
// DashboardStats.tsx
export function DashboardStats() {
  const stats = useDashboardStats();
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <StatCard
        title="Total Revenue"
        value={`Rp ${stats.totalRevenue.toLocaleString()}`}
        change="+12% from last month"
        icon="📈"
      />
      <StatCard
        title="Total Sales"
        value={stats.totalSales.toString()}
        change="+5% from last month"
        icon="🛒"
      />
      <StatCard
        title="Total Products"
        value={stats.totalProducts.toString()}
        change=""
        icon="📦"
      />
      <StatCard
        title="Low Stock Alert"
        value={stats.lowStockProducts.toString()}
        change="Requires attention"
        icon="⚠️"
        variant="warning"
      />
    </div>
  );
}
```

### **Charts:**
```typescript
// SalesChart.tsx
'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function SalesChart({ data }: { data: SalesDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip formatter={(value) => `Rp ${value.toLocaleString()}`} />
        <Line type="monotone" dataKey="revenue" stroke="#8884d8" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

---

## 11. Forms Validation (React Hook Form)

```typescript
// ProductForm.tsx
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const productSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  price: z.number().positive('Price must be positive'),
  stock: z.number().int().nonnegative('Stock cannot be negative'),
});

type ProductFormData = z.infer<typeof productSchema>;

export function ProductForm({ initialData, onSubmit }) {
  const { register, handleSubmit, formState: { errors } } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: initialData
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input 
        label="Product Name" 
        {...register('name')} 
        error={errors.name?.message} 
      />
      
      <Textarea 
        label="Description" 
        {...register('description')} 
        error={errors.description?.message} 
      />
      
      <Input 
        label="Category" 
        {...register('category')} 
        error={errors.category?.message} 
      />
      
      <Input 
        label="Price" 
        type="number"
        step="0.01"
        {...register('price', { valueAsNumber: true })}
        error={errors.price?.message} 
      />
      
      <Input 
        label="Stock" 
        type="number"
        {...register('stock', { valueAsNumber: true })}
        error={errors.stock?.message} 
      />

      <FileUpload label="Product Image" />

      <Button type="submit">Save Product</Button>
    </form>
  );
}
```

---

## 12. Authentication Flow

```typescript
// lib/auth-server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}

// middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const protectedRoutes = ['/dashboard', '/sales', '/purchases', '/inventory'];
  const authRoutes = ['/login', '/register'];

  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  );

  const isAuthRoute = authRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  );

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}
```

---

## 13. Deploy ke Vercel

### **13.1 Setup Vercel:**

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
cd trading-app
vercel
```

### **13.2 Environment Variables di Vercel:**

Tambahkan di Vercel Dashboard > Settings > Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

### **13.3 Continuous Deployment:**

Connect repository to Vercel untuk auto-deploy setiap push ke main branch.

---

## 14. Testing Strategy

### **Unit Tests:**
```typescript
// __tests__/utils/formatCurrency.test.ts
import { formatCurrency } from '@/lib/utils';

describe('formatCurrency', () => {
  test('formats numbers correctly', () => {
    expect(formatCurrency(1000)).toBe('Rp 1.000');
    expect(formatCurrency(1000000)).toBe('Rp 1.000.000');
  });
});
```

### **Integration Tests (Playwright):**
```typescript
// tests/sales.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Sales Module', () => {
  test('should create a new sale', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('[data-testid="new-sale-button"]');
    await page.fill('[name="customerName"]', 'John Doe');
    await page.click('[name="add-product"]');
    await page.click('[type="submit"]');
    await expect(page.locator('.success-message')).toContainText('Sale created successfully');
  });
});
```

---

## 15. Performance Optimization

### **Next.js Optimizations:**
- Use static generation for products page (`generateStaticParams`)
- Implement ISR for frequently accessed pages
- Lazy load heavy components dengan `dynamic()`
- Optimize images dengan Next/Image
- Code splitting dengan dynamic imports

### **Database Indexing:**
```sql
-- Add indexes for faster queries
create index idx_products_category on products(category);
create index idx_products_seller on products(seller_id);
create index idx_sales_created_by on sales(created_by);
create index idx_sales_date on sales(sale_date);
create index idx_sale_items_sale_id on sale_items(sale_id);
create index idx_purchase_items_purchase_id on purchase_items(purchase_id);
```

---

## 16. Security Best Practices

1. **Enable RLS on all tables** - Row Level Security aktif untuk protect data
2. **Sanitize user input** - Validasi semua input di form
3. **Use HTTPS** - Vercel auto-provide SSL certificate
4. **Rate limiting** - Gunakan middleware untuk prevent abuse
5. **Secure environment variables** - Never commit .env files
6. **Content Security Policy** - Set CSP headers
7. **Regular dependency updates** - Keep packages up-to-date

---

## 17. Development Workflow

### **Initial Setup:**
```bash
# Clone repository
git clone https://github.com/your-org/trading-app.git
cd trading-app

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Run database migrations (Supabase SQL Editor)
# Or use migration files in .supabase/migrations/

# Start development server
npm run dev
```

### **Available Scripts:**
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest",
    "test:e2e": "playwright test",
    "db:migrate": "supabase db push"
  }
}
```

---

## 18. Monitoring & Analytics

### **Tools to Integrate:**
- **Vercel Analytics** - Built-in performance tracking
- **Supabase Dashboard** - Monitor database usage
- **Sentry** - Error tracking
- **Plausible/Google Analytics** - User analytics

---

## 19. Future Enhancements

1. **Multi-currency support**
2. **Barcode scanner integration**
3. **Email notifications** (SendGrid/AWS SES)
4. **SMS notifications** (Twilio)
5. **Payment gateway integration** (Midtrans/Xendit)
6. **POS system** - For physical store
7. **Mobile app** - React Native/Expo
8. **Dark mode** theme toggle
9. **Offline mode** - PWA support
10. **Advanced reporting** - CSV/PDF export

---

## 20. Estimated Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| **Phase 1** | 2 weeks | Setup, Authentication, Basic UI |
| **Phase 2** | 2 weeks | Products & Inventory module |
| **Phase 3** | 2 weeks | Sales & Purchases module |
| **Phase 4** | 1 week | Dashboard & Reports |
| **Phase 5** | 1 week | Testing & Bug fixes |
| **Phase 6** | 1 week | Deploy & Documentation |
| **Total** | **~9 weeks** | Full development |

---

## 21. Cost Estimation (Monthly)

| Service | Free Tier | Pro Tier |
|---------|-----------|----------|
| **Vercel** | $0 | $20/month |
| **Supabase** | $5 (500MB DB) | $25/month (5GB DB) |
| **Domain** | $10-15/year | $10-15/year |
| **Total** | **~$0-5** | **~$45-50** |

---

## Kesimpulan

Perancangan aplikasi Trading Platform ini telah disiapkan dengan:

✅ **Struktur database yang comprehensive** dengan relasi yang tepat  
✅ **Stack teknologi modern** (Next.js, Supabase, Vercel)  
✅ **Fitur lengkap** untuk penjualan & pembelian  
✅ **Security best practices** (RLS, authentication)  
✅ **Scalable architecture** untuk pertumbuhan bisnis  
✅ **Developer experience optimal** dengan modern tooling  

Aplikasi siap untuk dikembangkan dan dapat di-deploy ke production dalam waktu ~9 minggu dengan tim kecil.
