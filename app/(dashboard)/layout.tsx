'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Truck,
  TrendingUp,
  Warehouse,
  Settings,
  UsersRound,
  Building2,
  Wallet,
  Menu,
  X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth-provider';
import { getSupabaseBrowserClient } from '@/lib/supabase';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Customers', href: '/customers', icon: UsersRound },
  { name: 'Suppliers', href: '/suppliers', icon: Building2 },
  { name: 'Sales', href: '/sales', icon: ShoppingBag },
  { name: 'Purchases', href: '/purchases', icon: Truck },
  { name: 'Finance', href: '/finance', icon: Wallet },
  { name: 'Inventory', href: '/inventory', icon: Warehouse },
  { name: 'Reports', href: '/reports', icon: TrendingUp },
];

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const { user, loading: authLoading, error: authError } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, router, user]);

  const signOut = async () => {
    setSignOutError('');
    const { error } = await getSupabaseBrowserClient().auth.signOut();
    if (error) setSignOutError(error.message);
  };

  if (authLoading) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Memeriksa sesi...</main>;
  }

  if (authError) {
    return <main className="flex min-h-screen items-center justify-center p-6"><p role="alert" className="max-w-lg rounded-lg border border-destructive/30 p-4 text-sm text-destructive">{authError}</p></main>;
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen w-64 bg-white dark:bg-card border-r border-border transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold">
              T
            </div>
            <span className="text-xl font-bold gradient-text bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Trading App
            </span>
          </Link>
          
          <button
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = item.href === '/dashboard'
              ? pathname === '/' || pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Navigation */}
        <nav className="absolute bottom-0 left-0 right-0 p-4 space-y-1 border-t">
          <Link
            href="/settings"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all"
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium">Settings</span>
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Top Bar */}
        <header className="h-16 bg-white dark:bg-card border-b sticky top-0 z-30">
          <div className="flex items-center justify-between h-full px-6">
            <button
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="ml-auto flex items-center gap-4">
              <>
                <span className="hidden text-sm text-muted-foreground sm:block">{user.email}</span>
                <Button variant="outline" size="sm" onClick={() => void signOut()}>Keluar</Button>
              </>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          {signOutError && <p role="alert" className="mb-4 rounded-md border border-destructive/30 p-3 text-sm text-destructive">Gagal keluar: {signOutError}</p>}
          {children}
        </main>
      </div>
    </div>
  );
}
