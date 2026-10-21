'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/auth-provider';
import { getSupabaseBrowserClient } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!authLoading && user) router.replace('/dashboard'); }, [authLoading, router, user]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const supabase = getSupabaseBrowserClient();
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        router.replace('/dashboard');
        return;
      }
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (authError) throw authError;
      if (data.session) router.replace('/dashboard');
      else setMessage('Pendaftaran berhasil. Periksa email untuk konfirmasi akun, lalu masuk.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Autentikasi gagal.');
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || user) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Memeriksa sesi...</main>;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">T</div>
          <CardTitle>{mode === 'login' ? 'Masuk ke Trading App' : 'Buat akun'}</CardTitle>
          <p className="text-sm text-muted-foreground">Autentikasi akun dikelola oleh Supabase.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && <div className="space-y-2"><Label htmlFor="full-name">Nama lengkap</Label><Input id="full-name" autoComplete="name" required value={fullName} onChange={(event) => setFullName(event.target.value)} /></div>}
            <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="password">Kata sandi</Label><Input id="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {message && <p role="status" className="text-sm text-green-700">{message}</p>}
            <Button className="w-full" type="submit" disabled={busy}><LogIn className="mr-2 h-4 w-4" />{busy ? 'Memproses...' : mode === 'login' ? 'Masuk' : 'Daftar'}</Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
            <button className="font-medium text-primary underline" type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage(''); }}>
              {mode === 'login' ? 'Daftar' : 'Masuk'}
            </button>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
