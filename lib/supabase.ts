import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | undefined;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (supabase) return supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Konfigurasi Supabase belum lengkap. Periksa NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di .env.local.');
  }

  supabase = createBrowserClient(url, key);
  return supabase;
}

export function getSupabaseErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === '42501' || error.code === 'PGRST301') {
    return 'Akses ditolak. Silakan masuk dan pastikan kebijakan Row Level Security Supabase sudah benar.';
  }
  if (error.code === '23505') return 'Data tersebut sudah ada. Periksa SKU atau nama varian yang harus unik.';
  if (error.code === '23503') return 'Data terkait tidak ditemukan. Muat ulang halaman dan coba lagi.';
  return error.message;
}
