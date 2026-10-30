import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Avatar } from '@/components/Avatar';
import { EloChart } from '@/components/EloChart';
import { EmblemMini } from '@/components/EmblemMini';
import { MatchList } from '@/components/MatchList';
import { getEloHistory, getHeadToHead, getProfileByAlias, getProfileStats, getRecentMatches, getRivalriesOf, labelsFor } from '@/lib/data';
import { getSession } from '@/lib/session';
import { ReportButton } from '@/components/ReportButton';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; alias: string }> }) {
  const { alias } = await params;
  return { title: decodeURIComponent(alias) };
}

export default async function PlayerPage({ params }: { params: Promise<{ locale: string; alias: string }> }) {
  const { locale, alias: raw } = await params;
  setRequestLocale(locale);
  const alias = decodeURIComponent(raw);
  const p = await getProfileByAlias(alias);
  if (!p) notFound();
  const t = await getTranslations('profile');
  const f = await getFormatter();
  const { profile: me } = await getSession();
  const [stats, hist, recent, rivalries, h2h] = await Promise.all([
    getProfileStats(p.id), getEloHistory(p.id, '1v1'), getRecentMatches(p.id), getRivalriesOf(p.id), getHeadToHead(p.id),
  ]);
  const s1 = stats.find((s) => (s as { mode?: string }).mode === '1v1');
  const s2 = stats.find((s) => (s as { mode?: string }).mode === '2v2');
  const labels = labelsFor(h2h);
  const rivals = h2h.length;
  const names = new Map<string, string>();
  rivalries.forEach((r) => { names.set(r.player_low, r.alias_low); names.set(r.player_high, r.alias_high); });
  const aliasOf = async (id: string) => names.get(id) ?? (await allAliasById(id));
  const isMe = me?.id === p.id;
  const cell = (label: string, value: string | number) => (
    <div className="pf-card" style={{ padding: '14px 18px' }}>
      <div className="pf-mono" style={{ fontSize: 26, fontWeight: 700 }}>{value}</div>
      <div style={{ color: 'var(--pf-muted)', fontSize: 13 }}>{label}</div>
    </div>
  );
  const nemesisAlias = labels.nemesis ? await aliasOf(labels.nemesis) : null;
  const victimAlias = labels.victim ? await aliasOf(labels.victim) : null;
  return (
    <div className="pf-container" style={{ paddingTop: 48, display: 'grid', gap: 32 }}>
      <header style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <Avatar id={p.id} alias={p.alias} color={p.avatar_color} size={72} />
        <div>
          <h1 className="pf-display" style={{ fontSize: 'clamp(34px,5vw,56px)' }}>{p.alias}</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {p.is_provisional_single ? <span className="pf-chip">{t('provisional')}</span> : null}
            {nemesisAlias ? <span className="pf-chip pf-chip-nemesis">{t('nemesisOf', { alias: nemesisAlias })}</span> : null}
            {victimAlias ? <span className="pf-chip">{t('victim', { alias: victimAlias })}</span> : null}
            {!p.is_active ? <span className="pf-chip">{t('inactive')}</span> : null}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {!isMe ? <Link href={`/retos/nuevo?a=${encodeURIComponent(p.alias)}`} className="pf-btn pf-btn-primary">{t('challenge')}</Link> : null}
          {me && !isMe ? <ReportButton targetProfile={p.id} /> : null}
        </div>
      </header>

      <section aria-label={t('stats')} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {cell('ELO 1v1', f.number(p.elo_single, { useGrouping: false }))}
        {cell('ELO 2v2', f.number(p.elo_double, { useGrouping: false }))}
        {cell(t('wl'), `${s1?.wins ?? 0}–${s1?.losses ?? 0}`)}
        {cell(t('streak'), !s1 || s1.streak === 0 ? '–' : `${s1.streak > 0 ? 'W' : 'L'}${Math.abs(s1.streak)}`)}
        {cell(t('rivals'), rivals)}
        {cell(t('games'), (p.games_single ?? 0) + (p.games_double ?? 0))}
        {s2 && s2.games > 0 ? cell('V–D 2v2', `${s2.wins}–${s2.losses}`) : null}
      </section>

      <section>
        <h2 className="pf-display" style={{ fontSize: 28, marginBottom: 12 }}>{t('chartTitle')}</h2>
        <div className="pf-card" style={{ padding: 16 }}><EloChart points={hist} /></div>
      </section>

      <section>
        <h2 className="pf-display" style={{ fontSize: 28, marginBottom: 12 }}>{t('rivalriesTitle')}</h2>
        {rivalries.length ? (
          <ul style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {rivalries.map((r) => {
              const otherAlias = r.player_low === p.id ? r.alias_high : r.alias_low;
              const myWins = r.player_low === p.id ? r.wins_low : r.wins_high;
              const theirWins = r.player_low === p.id ? r.wins_high : r.wins_low;
              const myRole = r.crow_id === p.id ? 'crow' : 'snake';
              return (
                <li key={r.player_low + r.player_high}>
                  <Link href={`/rivalidad/${p.alias}/${otherAlias}`} className="pf-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, textDecoration: 'none', minHeight: 64 }}>
                    <EmblemMini role={myRole} seed={r.seed} label={t(myRole === 'crow' ? 'roleCrow' : 'roleSnake')} />
                    <span style={{ fontWeight: 700 }}>{otherAlias}</span>
                    <span className="pf-mono" style={{ marginLeft: 'auto', fontWeight: 700 }}>{myWins}–{theirWins}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p style={{ color: 'var(--pf-muted)' }}>{t('noRivalries')}</p>
        )}
      </section>

      <section>
        <h2 className="pf-display" style={{ fontSize: 28, marginBottom: 12 }}>{t('lastMatches')}</h2>
        <MatchList matches={recent.matches} players={recent.players} perspective={p.id} />
      </section>
    </div>
  );
}

async function allAliasById(id: string): Promise<string | null> {
  const { supabaseServer } = await import('@/lib/supabase/server');
  const sb = await supabaseServer();
  const { data } = await sb.from('public_profiles').select('alias').eq('id', id).maybeSingle();
  return (data?.alias as string | undefined) ?? null;
}
