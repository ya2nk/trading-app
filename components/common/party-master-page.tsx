'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Pencil, Plus, Search, UsersRound } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSupabaseBrowserClient, getSupabaseErrorMessage } from '@/lib/supabase';

type PartyTable = 'customers' | 'suppliers';

interface Party {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
}

interface PartyForm {
  id: string | null;
  name: string;
  email: string;
  phone: string;
  address: string;
}

const emptyForm: PartyForm = { id: null, name: '', email: '', phone: '', address: '' };

export function PartyMasterPage({ type }: { type: PartyTable }) {
  const isCustomer = type === 'customers';
  const title = isCustomer ? 'Customer' : 'Supplier';
  const plural = isCustomer ? 'Customer' : 'Supplier';
  const Icon = isCustomer ? UsersRound : Building2;
  const { user } = useAuth();
  const [parties, setParties] = useState<Party[]>([]);
  const [form, setForm] = useState<PartyForm>(emptyForm);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const loadParties = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: queryError } = await getSupabaseBrowserClient()
      .from(type)
      .select('id, name, email, phone, address, is_active, created_at')
      .order('name');
    if (queryError) setError(getSupabaseErrorMessage(queryError));
    else setParties((data ?? []) as Party[]);
    setLoading(false);
  }, [type]);

  useEffect(() => { void loadParties(); }, [loadParties]);

  const visibleParties = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return parties;
    return parties.filter((party) =>
      [party.name, party.email, party.phone, party.address]
        .some((value) => value?.toLowerCase().includes(query))
    );
  }, [parties, search]);

  const saveParty = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      setError('Silakan masuk sebelum menyimpan data master.');
      return;
    }
    setSaving(true);
    setError('');
    setSaved(false);
    const supabase = getSupabaseBrowserClient();
    const values = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
    };
    const result = form.id
      ? await supabase.from(type).update(values).eq('id', form.id)
      : await supabase.from(type).insert({ ...values, created_by: user.id });
    if (result.error) {
      setError(result.error.code === '23505'
        ? `Nama ${title.toLowerCase()} tersebut sudah terdaftar di akun ini.`
        : getSupabaseErrorMessage(result.error));
    } else {
      setForm(emptyForm);
      setSaved(true);
      await loadParties();
    }
    setSaving(false);
  };

  const toggleActive = async (party: Party) => {
    setError('');
    const { error: updateError } = await getSupabaseBrowserClient()
      .from(type)
      .update({ is_active: !party.is_active })
      .eq('id', party.id);
    if (updateError) setError(getSupabaseErrorMessage(updateError));
    else await loadParties();
  };

  const editParty = (party: Party) => {
    setSaved(false);
    setForm({
      id: party.id,
      name: party.name,
      email: party.email ?? '',
      phone: party.phone ?? '',
      address: party.address ?? '',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Master {plural}</h1>
          <p className="mt-1 text-muted-foreground">Kelola data {plural.toLowerCase()} untuk transaksi.</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setSaved(false); }}>
          <Plus className="mr-2 h-4 w-4" />{`Tambah ${title}`}
        </Button>
      </div>

      {error && (
        <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <p>{error}</p>
          {error.includes('does not exist') || error.includes('schema cache') ? (
            <p>Jalankan migrasi <code>customer-supplier-migration.sql</code> di Supabase SQL Editor, lalu muat ulang halaman.</p>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => void loadParties()}>Coba lagi</Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_2fr]">
        <Card>
          <CardHeader><CardTitle>{form.id ? `Ubah ${title}` : `${title} Baru`}</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(event) => void saveParty(event)}>
              <div className="space-y-2">
                <Label htmlFor="party-name">Nama</Label>
                <Input id="party-name" required maxLength={150} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={`Nama ${title.toLowerCase()}`} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="party-email">Email (opsional)</Label>
                <Input id="party-email" type="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="party-phone">Nomor telepon (opsional)</Label>
                <Input id="party-phone" type="tel" maxLength={40} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="party-address">Alamat (opsional)</Label>
                <textarea id="party-address" maxLength={500} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              {!user && <p className="text-sm text-amber-700">Masuk untuk menambah atau mengubah data master.</p>}
              {saved && <p role="status" className="text-sm text-green-700">Data berhasil disimpan.</p>}
              <div className="flex justify-end gap-2">
                {form.id && <Button type="button" variant="outline" onClick={() => setForm(emptyForm)}>Batal</Button>}
                <Button type="submit" disabled={saving || !user}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Cari ${plural.toLowerCase()}...`} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b text-muted-foreground"><th className="p-3">Nama</th><th className="p-3">Kontak</th><th className="p-3">Status</th><th className="p-3 text-right">Aksi</th></tr></thead>
                <tbody>
                  {visibleParties.map((party) => (
                    <tr key={party.id} className="border-b last:border-0">
                      <td className="p-3"><p className="font-medium">{party.name}</p>{party.address && <p className="mt-1 max-w-xs truncate text-xs text-muted-foreground">{party.address}</p>}</td>
                      <td className="p-3"><p>{party.phone || '—'}</p>{party.email && <p className="text-xs text-muted-foreground">{party.email}</p>}</td>
                      <td className="p-3"><Badge variant={party.is_active ? 'secondary' : 'outline'}>{party.is_active ? 'Aktif' : 'Nonaktif'}</Badge></td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" disabled={!user} onClick={() => editParty(party)}><Pencil className="mr-1 h-3.5 w-3.5" />Ubah</Button>
                          <Button variant="outline" size="sm" disabled={!user} onClick={() => void toggleActive(party)}>{party.is_active ? 'Nonaktifkan' : 'Aktifkan'}</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loading && <p className="py-8 text-center text-muted-foreground">Memuat {plural.toLowerCase()}...</p>}
              {!loading && !error && visibleParties.length === 0 && <div className="py-10 text-center text-muted-foreground"><Icon className="mx-auto mb-2 h-8 w-8" />{search ? 'Tidak ada data yang cocok.' : `Belum ada ${plural.toLowerCase()}.`}</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
