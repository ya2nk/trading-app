# Trading App - Sales & Purchase Management System

A comprehensive web-based application for managing product sales and purchases, built with Next.js 14, Supabase, and deployed on Vercel.

## Features

### Core Functionality
- ✅ **Product Management** - CRUD operations with images and stock tracking
- ✅ **Customer & Supplier Master Data** - Manage counterparties and select them on sales/purchase transactions
- ✅ **Sales Management** - Create transactions, cart system, invoices
- ✅ **Purchase Management** - Supplier management, restocking
- ✅ **Inventory Tracking** - Real-time stock updates with audit logs
- ✅ **Dashboard** - Analytics charts and KPI metrics
- ✅ **Reports** - Sales reports, revenue analytics, inventory summaries
- ✅ **Authentication** - Email/password + OAuth (Google, GitHub)
- ✅ **Role-based Access** - User and Admin roles

> **Integrasi Supabase:** Katalog, transaksi, inventaris, laporan, dan profil membaca/menulis data melalui Supabase. Masuk atau daftar di `/login` untuk operasi yang memerlukan autentikasi. Penjualan dan pembelian yang diselesaikan memperbarui stok melalui trigger database.

### Technical Stack
- **Frontend:** Next.js 14 (App Router), React 18, TypeScript
- **Styling:** Tailwind CSS, Shadcn/UI components
- **Backend:** Supabase (PostgreSQL, Auth, Storage)
- **State Management:** Zustand, React Context
- **Forms:** React Hook Form + Zod validation
- **Charts:** Recharts
- **Hosting:** Vercel

## Getting Started

### Prerequisites
- Node.js 18 or higher
- Supabase account (free tier available)
- Git (optional, for version control)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/trading-app.git
   cd trading-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**
   
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

   Add the Supabase project URL and the public anon/publishable key:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
   The browser client only uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Never expose a Supabase service-role key in a `NEXT_PUBLIC_` variable or browser code.

4. **Setup Supabase Database**
   
   Go to your Supabase project → SQL Editor and run `database-migration.sql` if the schema has not been created yet. Do not rerun the full migration over existing tables. Then run the additive `customer-supplier-migration.sql` and `order-workflow-migration.sql` once each. The order workflow migration adds supplier-ready dates, partial receiving, customer payment records, and secure database functions for recording payments and received stock.

5. **Create an account**

   Start the app, open `/login`, and register with an email and password. If email confirmation is enabled in Supabase Auth, confirm the email before signing in. The signup trigger creates the user's profile.

6. **Setup product image storage**

   Run `product-image-storage.sql` once in the Supabase SQL Editor. It creates or configures the public `product_images` bucket (10 MB per image) and policies that allow signed-in users to upload and delete only their own product images.

7. **Start development server**
   ```bash
   npm run dev
   ```

8. **Open application**
   
   Navigate to `http://localhost:3000`

## Available Scripts

```bash
# Development
npm run dev          # Start dev server at localhost:3000

# Production
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Utilities
npm run type-check   # TypeScript type checking
npm run test         # Run unit tests
npm run test:e2e     # Run end-to-end tests
```

## Project Structure

```
trading-app/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication routes
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/       # Protected dashboard routes
│   │   ├── page.tsx       # Dashboard overview
│   │   ├── products/      # Product management
│   │   ├── sales/         # Sales transactions
│   │   ├── purchases/     # Purchase transactions
│   │   ├── inventory/     # Stock management
│   │   └── reports/       # Analytics & reports
│   ├── api/               # API routes (if needed)
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── products/         # Product-specific components
│   ├── sales/            # Sales-specific components
│   ├── purchases/        # Purchase-specific components
│   └── common/           # Reusable components
├── lib/                  # Utility libraries
│   ├── supabase/         # Supabase clients
│   ├── utils.ts          # Helper functions
│   └── types.ts          # TypeScript types
├── stores/               # Zustand state stores
├── hooks/                # Custom React hooks
├── styles/               # Global styles
├── public/               # Static assets
├── database-migration.sql  # Initial database schema
└── customer-supplier-migration.sql  # Additive customer/supplier schema
```

## Configuration

### Tailwind CSS

Customize in `tailwind.config.js`. Uses dark mode support out of the box.

### Supabase Configuration

Update RLS policies in `database-migration.sql` based on your requirements:
- View own data only
- Allow public view of active products
- Admin override capabilities

### Purchase Orders and Customer Payments

- Create a supplier PO with an estimated date when the goods will be ready at the supplier. Confirm readiness when the supplier confirms it; record actual received quantities when the goods arrive at the store. Stock increases only for quantities recorded as received.
- A customer order can be created even when current stock is insufficient. Link supplier POs to the order, receive the goods, and then complete the customer order to reduce stock.
- Record an optional down payment when creating a customer order, then record each installment from the order detail page. The remaining balance is calculated from payment records and cannot be overpaid.
- Apply `order-workflow-migration.sql` before using these screens on an existing database.

### Finance (Pemasukan & Pengeluaran)

- Menu **Finance** mencatat pemasukan dan pengeluaran manual, misalnya pembelian ATK, gaji, sewa, atau utilitas.
- Setiap DP/cicilan customer yang dicatat di detail pesanan otomatis masuk sebagai pemasukan (kategori "Penjualan / Cicilan") lewat trigger database, termasuk pembayaran lama yang sudah ada sebelum migrasi.
- Entri otomatis bertanda "Otomatis · cicilan" dan tidak bisa dihapus dari halaman Keuangan.
- Apply `finance-migration.sql` once in the Supabase SQL Editor (after `order-workflow-migration.sql`) before using the Finance page.

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon/publishable key used by the browser client | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Not used by this app; keep server-only if added for a future server task | No |

## Deployment

### Deploy to Vercel

1. **Push to GitHub/GitLab**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Import to Vercel**
   - Go to vercel.com
   - Click "Add New Project"
   - Import your repository
   - Configure environment variables
   - Click "Deploy"

3. **Environment Variables in Vercel**
   
   Go to Settings → Environment Variables and add:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

4. **Auto-deploy enabled**
   
   Every push to main branch will automatically deploy!

## Security Features

- ✅ Row Level Security (RLS) on all tables
- ✅ Secure authentication flow
- ✅ Input validation with Zod
- ✅ Protected API routes
- ✅ Environment variable security
- ✅ HTTPS enforced by Vercel

## Database Schema

### Main Tables
- **profiles** - User accounts and roles
- **products** - Product catalog
- **sales** - Sales transactions
- **sale_items** - Line items for sales
- **purchases** - Purchase/stock transactions  
- **purchase_items** - Line items for purchases
- **inventory_logs** - Audit trail for stock changes

### Views
- **daily_sales_summary** - Daily revenue analytics
- **top_selling_products** - Best-performing items
- **low_stock_products** - Inventory alerts

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## Roadmap

- [ ] Multi-currency support
- [ ] Barcode scanner integration
- [ ] Payment gateway (Midtrans/Xendit)
- [ ] Email notifications
- [ ] Mobile PWA support
- [ ] Advanced reporting (PDF export)
- [ ] POS system for physical store
- [ ] Dark mode toggle

## Support

For questions or issues:
- 📧 Email: support@example.com
- 🐛 GitHub Issues
- 💬 Discord Community

## License

MIT License - feel free to use for personal or commercial projects.

---

Built with ❤️ using Next.js and Supabase
