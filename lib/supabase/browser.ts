'use client';
import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Cliente de navegador: solo para Realtime (avisos y chat). Las escrituras van por server actions. */
export function supabaseBrowser() {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
