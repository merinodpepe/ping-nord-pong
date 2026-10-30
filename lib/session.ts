import 'server-only';
import { cache } from 'react';
import { hasSupabase } from '@/lib/env';
import { supabaseServer } from '@/lib/supabase/server';

export type Me = {
  id: string; alias: string; avatar_color: number; locale: string; elo_single: number; elo_double: number;
  games_single: number; games_double: number; role: 'user' | 'mod' | 'admin'; status: 'active' | 'limited' | 'banned';
  limited_until: string | null; terms_version: string; email: string | undefined;
};

/** Usuario autenticado (verificado con el servidor de auth) y su perfil. `profile` es null si aún no hizo el onboarding. */
export const getSession = cache(async () => {
  if (!hasSupabase()) return { user: null, profile: null as Me | null };
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  const user = data.user;
  if (!user) return { user: null, profile: null as Me | null };
  const { data: p } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return { user, profile: p ? ({ ...p, email: user.email } as Me) : null };
});
