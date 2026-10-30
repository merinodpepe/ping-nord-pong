import 'server-only';
import { hasSupabase } from '@/lib/env';
import { supabaseServer } from '@/lib/supabase/server';

/** Alias públicos para el autocompletado de rival. Solo id y alias. */
export async function allPlayers(): Promise<{ id: string; alias: string }[]> {
  if (!hasSupabase()) return [];
  const sb = await supabaseServer();
  const { data } = await sb.from('public_profiles').select('id, alias').order('alias').limit(2000);
  return (data ?? []) as { id: string; alias: string }[];
}
