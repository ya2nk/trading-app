'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/auth-provider';
import { getSupabaseBrowserClient, getSupabaseErrorMessage } from '@/lib/supabase';

export default function SettingsPage() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let active = true;
    void getSupabaseBrowserClient().from('profiles').select('full_name, email').eq('id', user.id).maybeSingle().then(({ data, error: queryError }) => {
      if (!active) return;
      if (queryError) setError(getSupabaseErrorMessage(queryError));
      setName(data?.full_name ?? user.user_metadata.full_name ?? '');
      setEmail(data?.email ?? user.email ?? '');
      setLoading(false);
    });
    return () => { active = false; };
  }, [user]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setError('');
    setSaved(false);
    const { error: saveError } = await getSupabaseBrowserClient().from('profiles').upsert({
      id: user.id,
      full_name: name.trim(),
      email: email.trim(),
    }, { onConflict: 'id' });
    if (saveError) setError(getSupabaseErrorMessage(saveError));
    else setSaved(true);
    setSaving(false);
  };

  return <div className="mx-auto max-w-3xl space-y-6">
    <div><h1 className="text-3xl font-bold">Pengaturan</h1><p className="mt-1 text-muted-foreground">Profil akun Supabase Anda.</p></div>
    {!user ? <div className="rounded-lg border p-5"><p className="mb-3 text-muted-foreground">Masuk untuk mengelola profil.</p><Link href="/login"><Button>Masuk</Button></Link></div> : <>
      <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><Info className="h-5 w-5 shrink-0" /><p>Perubahan profil disimpan ke tabel profiles Supabase.</p></div>
      <Card><CardHeader><CardTitle>Profil</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={(event) => void submit(event)}>
        <div className="space-y-2"><Label htmlFor="profile-name">Nama</Label><Input id="profile-name" required disabled={loading} value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} /></div>
        <div className="space-y-2"><Label htmlFor="profile-email">Email akun</Label><Input id="profile-email" type="email" readOnly disabled={loading} value={email} /><p className="text-xs text-muted-foreground">Email autentikasi dikelola oleh Supabase Auth.</p></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center justify-between"><span role="status" className="text-sm text-green-700">{saved && <><Check className="mr-1 inline h-4 w-4" />Profil tersimpan.</>}</span><Button type="submit" disabled={saving || loading}>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</Button></div>
      </form></CardContent></Card>
    </>}
  </div>;
}
