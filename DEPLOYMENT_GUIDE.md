# 🚀 Deployment Guide - Trading App

Panduan lengkap untuk deploying aplikasi Trading ke production dengan **Vercel** dan **Supabase**.

---

## 📋 Prerequisites

Pastikan Anda sudah memiliki:

- ✅ GitHub/GitLab account
- ✅ Vercel account (vercel.com)
- ✅ Supabase account (supabase.com)
- ✅ Node.js 18+ installed
- ✅ npm/yarn/pnpm

---

## 🔧 Step 1: Setup Supabase Database

### 1.1 Create Supabase Project

1. Login ke [supabase.com](https://supabase.com)
2. Click **"New Project"**
3. Fill in the details:
   - **Project name**: `trading-app`
   - **Database password**: (strong password, simpan di tempat aman!)
   - **Region**: Pilih region terdekat (Singapore recommended untuk Indonesia)
4. Click **"Create new project"**

Wait ~2 minutes untuk setup complete.

### 1.2 Run Database Migration

1. Di dashboard project, click **"SQL Editor"** di sidebar kiri
2. Klik **"New query"** → **"Empty query"**
3. Copy & paste isi file `database-migration.sql`
4. Click **"Run"** atau tekan `Ctrl+Enter`

Tunggu hingga semua tabel berhasil dibuat! ✅

> **Jika database sudah pernah dibuat:** jangan jalankan ulang `database-migration.sql`. Jalankan file tambahan `customer-supplier-migration.sql` satu kali di SQL Editor untuk menambahkan tabel master Customer/Supplier dan menghubungkan riwayat transaksi lama.

### 1.3 Setup Storage Gambar Produk

Jalankan file `product-image-storage.sql` satu kali di **SQL Editor**. File ini membuat atau mengonfigurasi bucket publik `product_images` (maksimal 10 MB per gambar), mengizinkan gambar dilihat publik, dan membatasi upload serta penghapusan ke gambar milik pengguna yang sedang masuk.

### 1.4 PO Supplier dan Pembayaran Customer

Pada halaman **SQL Editor**, jalankan `order-workflow-migration.sql` satu kali. Setelah migrasi, buat PO dengan estimasi tanggal barang ready di supplier, konfirmasi saat supplier menyatakan barang siap, dan catat jumlah yang diterima saat barang tiba. Stok hanya bertambah saat penerimaan dicatat. DP dan cicilan customer dicatat dari detail pesanan; sisa tagihan dihitung otomatis.

### 1.5 Configure RLS Policies

SQL migration sudah include RLS policies. Verify bahwa policies aktif di menu **Database** → **Replication** atau cek via SQL:

```sql
-- Verify RLS is enabled on all tables
select tablename, rowsecurity 
from pg_tables 
where schemaname = 'public'
order by tablename;
```

Semua harus `true`.

### 1.6 Get Your Credentials

Copy credentials ini untuk Vercel environment variables:

1. Go to **Settings** → **API**
2. Copy:
   - **Project URL**: `https://your-project.supabase.co`
   - **anon/public key** (atau publishable key): `your-public-key`

> Aplikasi browser hanya memerlukan URL proyek dan kunci publik. Jangan masukkan `service_role` key ke aplikasi atau environment variable `NEXT_PUBLIC_`.

---

## 🎯 Step 2: Local Testing (Optional)

### 2.1 Install Dependencies

```bash
npm install
# or
yarn install
```

### 2.2 Set Up Environment Variables

Copy `.env.example` → `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2.3 Run Development Server

```bash
npm run dev
```

Open `http://localhost:3000` dan verify app berjalan!

---

## 🌐 Step 3: Deploy ke Vercel

### 3.1 Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Trading App"
git branch -M main
git remote add origin https://github.com/your-username/trading-app.git
git push -u origin main
```

### 3.2 Connect to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New...** → **Project**
2. Import your GitHub repository
3. Configure project settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

### 3.3 Add Environment Variables

Di Vercel dashboard, buka **Settings** → **Environment Variables**:

Add these variables:

| Key | Value | Environment |
|-----|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | your-supabase-url | Build & Deploy |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your-anon-key | Build & Deploy |

Click **"Apply"**

### 3.4 Deploy!

Click **"Deploy"** button

Vercel akan:
- ⏳ Building... (~2-5 menit)
- ✅ Deploying...
- 🎉 Done!

Your app will be live at:
- **Development**: `https://your-project.vercel.app`
- **Production**: `https://your-project.vercel.app`

---

## 🔒 Step 4: Security Configuration

### 4.1 Enable HTTPS

Vercel automatically enables HTTPS. No action needed! ✅

### 4.2 Domain Setup (Optional)

To use custom domain:

1. Go to **Vercel Dashboard** → **Domains**
2. Add your domain (e.g., `trading.yourcompany.com`)
3. Follow DNS configuration instructions
4. Wait for SSL certificate issuance (~10-30 minutes)

### 4.3 Environment Variables Protection

Never commit `.env.local` or any secret files to git:

```bash
# In .gitignore (already included)
.env
.env.local
.env.*.local
```

---

## 📊 Step 5: Monitoring & Analytics

### 5.1 Vercel Analytics

Enable analytics in Vercel Dashboard:

1. **Analytics** → **Enable**
2. View real-time traffic, performance metrics

### 5.2 Supabase Dashboard

Monitor database usage:

1. **Supabase Dashboard** → **Usage**
2. Check:
   - Database size
   - Bandwidth
   - Active users

Set up alerts for limits!

### 5.3 Error Tracking (Recommended)

Integrate **Sentry** for error tracking:

```bash
npm install @sentry/nextjs
npx sentry-wizard -i nextjs
```

---

## 🔄 Step 6: Continuous Deployment

### Auto-Deploy from Git

Every time you push to `main` branch:

1. Vercel automatically detects changes
2. Runs tests & builds
3. Deploys to production

**Setup Branch-based Deployments:**

- `main` → Production
- `develop` → Staging/UAT
- Feature branches → Preview URLs

---

## 🎨 Step 7: Customizations

### Change Theme Colors

Edit `styles/globals.css`:

```css
:root {
  --primary: 221.2 83.2% 53.3%; /* Blue */
  --accent: 280 65% 60%;         /* Purple */
}
```

### Add Features

1. **Email Notifications**: Integrate SendGrid/AWS SES
2. **Payment Gateway**: Midtrans/Xendit
3. **SMS Alerts**: Twilio

Update code → Commit → Auto-deploy to Vercel!

---

## 🐛 Troubleshooting

### Issue: "Cannot connect to Supabase"

**Solution**:
- Verify environment variables in Vercel are correct
- Check CORS settings in Supabase (should allow your Vercel domain)

### Issue: "Image upload fails"

**Solution**:
- Verify storage bucket `product_images` exists and is public
- Verify `product-image-storage.sql` policies allow authenticated uploads

### Issue: "Build fails"

**Solution**:
- Check Vercel build logs
- Verify TypeScript errors locally first
- Ensure all dependencies are in `package.json`

---

## 📈 Performance Tips

### Optimize Images

Before uploading product images:
- Compress images (target < 500KB per image)
- Use WebP format
- Resize appropriately (max 1200px width)

### Enable Compression

Vercel automatically enables compression (gzip/brotli). No config needed!

### Database Optimization

Add indexes for frequently queried columns:

```sql
create index idx_products_active_category on products(is_active, category);
create index idx_sales_completed_date on sales(status, sale_date) where status = 'completed';
```

---

## 💰 Cost Breakdown

### Free Tier (Good for small business)

- **Vercel**: Free (up to 100GB bandwidth/month)
- **Supabase**: Free (500MB database, 2GB bandwidth)
- **Total**: $0/month

### Pro Tier (Growing business)

- **Vercel**: Pro ($20/month)
- **Supabase**: Pro ($25/month, 5GB DB)
- **Domain**: ~$15/year
- **Total**: ~$45-50/month

---

## ✨ Bonus: CI/CD with GitHub Actions

Auto-run tests before deployment:

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Type check
        run: npm run type-check
```

---

## 📞 Support & Resources

- **Documentation**: [Next.js Docs](https://nextjs.org/docs)
- **Supabase Docs**: [Supabase Docs](https://supabase.com/docs)
- **Vercel Docs**: [Vercel Docs](https://vercel.com/docs)
- **Community**: Join Discord servers for support

---

## ✅ Deployment Checklist

Before going live, verify:

- [ ] All environment variables configured
- [ ] Database migrations executed
- [ ] Storage buckets created
- [ ] RLS policies tested
- [ ] Images uploading correctly
- [ ] Sales/Purchases working end-to-end
- [ ] User authentication functional
- [ ] Responsive design on mobile
- [ ] SEO meta tags present
- [ ] Error handling in place
- [ ] Backups configured (Supabase auto-backups)
- [ ] Monitoring set up

---

## 🎉 You're Live!

Aplikasi Trading App Anda sekarang sudah running di production dengan fitur lengkap:

✅ Multi-varian products dengan harga berbeda  
✅ Stock management per varian  
✅ Sales & Purchase transactions  
✅ Dashboard dengan analytics  
✅ Modern, responsive UI  
✅ Secure & scalable architecture  

Selamat! 🚀🎊
