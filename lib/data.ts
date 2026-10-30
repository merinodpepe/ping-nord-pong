import 'server-only';
import { hasSupabase } from '@/lib/env';
import { supabaseServer } from '@/lib/supabase/server';

export type Mode = '1v1' | '2v2';

export type RankRow = {
  profile_id: string; alias: string; avatar_color: number; elo: number; games: number; wins: number; losses: number;
  streak: number; delta7: number; is_provisional: boolean; is_active: boolean;
};
export type Rivalry = {
  player_low: string; player_high: string; alias_low: string; alias_high: string; wins_low: number; wins_high: number;
  total: number; crow_id: string; snake_id: string; seed: number; crow_wins: number; snake_wins: number;
  emblem_state: number; prev_state: number | null; last_match_at: string; matches_7d: number;
  streak_owner: string | null; streak_len: number | null; by_format: Record<string, { low: number; high: number }>;
};
export type PublicProfile = {
  id: string; alias: string; avatar_color: number; elo_single: number; elo_double: number; games_single: number;
  games_double: number; is_provisional_single: boolean; is_provisional_double: boolean; is_active: boolean; last_played_at: string | null;
};
export type MatchRow = {
  id: string; mode: Mode; points_target: number; best_of: number; winner_team: 'A' | 'B'; played_at: string;
  confirmed_at: string; sets: [number, number][];
};
export type MatchPlayer = {
  match_id: string; team: 'A' | 'B'; slot: number; profile_id: string | null; alias: string | null; avatar_color: number | null;
  elo_before: number | null; elo_after: number | null; delta: number | null; weight_w: number | null; weight_m: number | null; k: number | null;
};
export type Home = {
  players: number; matches: number; rivalries: number; matches7d: number;
  top: RankRow[]; week: Rivalry | null;
};

/** Sin Supabase configurado (desarrollo, build, CI) todo devuelve vacío y la UI enseña estados vacíos, nunca cifras inventadas. */
async function db() {
  if (!hasSupabase()) return null;
  return supabaseServer();
}

export async function getRanking(mode: Mode, scope: 'active' | 'all', q?: string): Promise<RankRow[]> {
  const sb = await db();
  if (!sb) return [];
  let query = sb.from('player_mode_stats').select('*').eq('mode', mode).gt('games', 0);
  if (scope === 'active') query = query.eq('is_active', true).eq('is_provisional', false);
  if (q) query = query.ilike('alias', `%${q.replace(/[%_\\]/g, '')}%`);
  const { data } = await query.order('elo', { ascending: false }).order('games', { ascending: false }).limit(200);
  return (data ?? []) as RankRow[];
}

export async function getHome(): Promise<Home> {
  const sb = await db();
  const empty: Home = { players: 0, matches: 0, rivalries: 0, matches7d: 0, top: [], week: null };
  if (!sb) return empty;
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const [p, m, r, m7, top, week] = await Promise.all([
    sb.from('public_profiles').select('id', { count: 'exact', head: true }),
    sb.from('public_matches').select('id', { count: 'exact', head: true }),
    sb.from('rivalries').select('player_low', { count: 'exact', head: true }),
    sb.from('public_matches').select('id', { count: 'exact', head: true }).gte('confirmed_at', since),
    getRanking('1v1', 'active'),
    sb.from('rivalries').select('*').gt('matches_7d', 0).order('matches_7d', { ascending: false }).limit(5),
  ]);
  const w = ((week.data ?? []) as Rivalry[]).sort(
    (a, b) => b.matches_7d - a.matches_7d || Math.abs(a.wins_low - a.wins_high) - Math.abs(b.wins_low - b.wins_high),
  )[0];
  return {
    players: p.count ?? 0, matches: m.count ?? 0, rivalries: r.count ?? 0, matches7d: m7.count ?? 0,
    top: top.slice(0, 8), week: w ?? null,
  };
}

export async function getProfileByAlias(alias: string): Promise<PublicProfile | null> {
  const sb = await db();
  if (!sb) return null;
  const { data } = await sb.from('public_profiles').select('*').ilike('alias', alias.replace(/[%_\\]/g, '')).maybeSingle();
  return (data as PublicProfile | null) ?? null;
}

export async function getProfileStats(id: string) {
  const sb = await db();
  if (!sb) return [] as RankRow[];
  const { data } = await sb.from('player_mode_stats').select('*').eq('profile_id', id);
  return (data ?? []) as (RankRow & { mode: Mode })[];
}

export async function getEloHistory(id: string, mode: Mode) {
  const sb = await db();
  if (!sb) return [];
  const { data } = await sb.from('elo_history').select('confirmed_at, elo_after, delta, match_id')
    .eq('profile_id', id).eq('mode', mode).order('confirmed_at', { ascending: true }).limit(200);
  return (data ?? []) as { confirmed_at: string; elo_after: number; delta: number; match_id: string }[];
}

export async function getRecentMatches(id: string, limit = 10) {
  const sb = await db();
  if (!sb) return { matches: [] as MatchRow[], players: [] as MatchPlayer[] };
  const { data: mine } = await sb.from('public_match_players').select('match_id').eq('profile_id', id).limit(500);
  const ids = (mine ?? []).map((r) => r.match_id as string);
  if (!ids.length) return { matches: [], players: [] };
  const { data: matches } = await sb.from('public_matches').select('*').in('id', ids).order('confirmed_at', { ascending: false }).limit(limit);
  const list = (matches ?? []) as MatchRow[];
  const { data: players } = await sb.from('public_match_players').select('*').in('match_id', list.map((m) => m.id));
  return { matches: list, players: (players ?? []) as MatchPlayer[] };
}

export async function getRivalriesOf(id: string) {
  const sb = await db();
  if (!sb) return [] as Rivalry[];
  const { data } = await sb.from('rivalries').select('*').or(`player_low.eq.${id},player_high.eq.${id}`).order('total', { ascending: false });
  return (data ?? []) as Rivalry[];
}

export async function getHeadToHead(id: string) {
  const sb = await db();
  if (!sb) return [] as { rival_id: string; total: number; wins: number; losses: number }[];
  const { data } = await sb.from('head_to_head').select('rival_id, total, wins, losses').eq('player_id', id);
  return (data ?? []) as { rival_id: string; total: number; wins: number; losses: number }[];
}

export async function getRivalry(aliasA: string, aliasB: string) {
  const a = await getProfileByAlias(aliasA);
  const b = await getProfileByAlias(aliasB);
  if (!a || !b) return null;
  const sb = await db();
  if (!sb) return null;
  const [lo, hi] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
  const { data } = await sb.from('rivalries').select('*').eq('player_low', lo).eq('player_high', hi).maybeSingle();
  if (!data) return null;
  const { data: ms } = await sb.from('public_match_players').select('match_id').eq('profile_id', a.id).limit(500);
  const { data: ms2 } = await sb.from('public_match_players').select('match_id').eq('profile_id', b.id).limit(500);
  const bset = new Set((ms2 ?? []).map((r) => r.match_id as string));
  const shared = (ms ?? []).map((r) => r.match_id as string).filter((x) => bset.has(x));
  const { data: matches } = shared.length
    ? await sb.from('public_matches').select('*').in('id', shared).eq('mode', '1v1').order('confirmed_at', { ascending: false }).limit(10)
    : { data: [] };
  return { rivalry: data as Rivalry, a, b, matches: (matches ?? []) as MatchRow[] };
}

export async function getRivalries(limit = 30) {
  const sb = await db();
  if (!sb) return [] as Rivalry[];
  const { data } = await sb.from('rivalries').select('*').order('total', { ascending: false }).limit(limit);
  return (data ?? []) as Rivalry[];
}

export async function allAliases() {
  const sb = await db();
  if (!sb) return [] as string[];
  const { data } = await sb.from('public_profiles').select('alias').limit(5000);
  return (data ?? []).map((r) => r.alias as string);
}

/** Etiquetas por jugador (5.4) a partir del cara a cara 1v1. */
export function labelsFor(h2h: { rival_id: string; total: number; wins: number; losses: number }[]) {
  const eligible = h2h.filter((r) => r.total >= 5);
  const balance = (r: { wins: number; losses: number }) => r.wins - r.losses;
  const nemesis = [...eligible].sort((a, b) => balance(a) - balance(b))[0];
  const victim = [...eligible].sort((a, b) => balance(b) - balance(a))[0];
  return {
    nemesis: nemesis && balance(nemesis) < 0 ? nemesis.rival_id : null,
    victim: victim && balance(victim) > 0 ? victim.rival_id : null,
    even: h2h.filter((r) => r.total >= 8 && Math.abs(balance(r)) <= 1).map((r) => r.rival_id),
  };
}
