import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { MatchList } from '@/components/MatchList';
import { RivalryEmblem } from '@/components/RivalryEmblem';
import { getRecentMatches, getRivalry } from '@/lib/data';
import { initials } from '@/lib/avatar';
import { getSession } from '@/lib/session';

export async function generateMetadata({ params }: { params: Promise<{ a: string; b: string }> }) {
  const { a, b } = await params;
  return {
    title: `${decodeURIComponent(a)} vs ${decodeURIComponent(b)}`,
    openGraph: { images: [`/api/og/${a}/${b}`] },
  };
}

export default async function RivalryPage({ params }: { params: Promise<{ locale: string; a: string; b: string }> }) {
  const { locale, a, b } = await params;
  setRequestLocale(locale);
  const data = await getRivalry(decodeURIComponent(a), decodeURIComponent(b));
  if (!data) notFound();
  const { rivalry: r, a: pa, b: pb } = data;
  const t = await getTranslations('rivalry');
  const { profile: me } = await getSession();
  const crow = r.crow_id === pa.id ? pa : pb;
  const snake = r.crow_id === pa.id ? pb : pa;
  const winsA = pa.id === r.player_low ? r.wins_low : r.wins_high;
  const winsB = pa.id === r.player_low ? r.wins_high : r.wins_low;
  const leader = winsA === winsB ? null : winsA > winsB ? pa : pb;
  const recent = await getRecentMatches(pa.id, 40);
  const shared = recent.matches.filter((m) => m.mode === '1v1' && recent.players.some((p) => p.match_id === m.id && p.profile_id === pb.id)).slice(0, 8);
  const label = leader
    ? t('emblemLabel', { crow: crow.alias, snake: snake.alias, leader: leader.alias, a: Math.max(winsA, winsB), b: Math.min(winsA, winsB) })
    : t('emblemLabelTie', { crow: crow.alias, snake: snake.alias });
  const asking = me && (me.id === pa.id || me.id === pb.id) ? (me.id === pa.id ? pb : pa) : null;
  const fmt = (['5', '7', '11', '21'] as const).filter((k) => r.by_format?.[k]);
  return (
    <div className="pf-container" style={{ paddingTop: 32, maxWidth: 720 }}>
      <Link href="/rivalidades" style={{ color: 'var(--pf-muted)', textDecoration: 'none', display: 'inline-flex', minHeight: 44, alignItems: 'center' }}>← {t('back')}</Link>
      <div style={{ display: 'grid', placeItems: 'center', margin: '8px 0 12px' }}>
        <RivalryEmblem crowIni={initials(crow.alias)} snakeIni={initials(snake.alias)} state={r.emblem_state} prevState={r.prev_state} seed={r.seed} size={320} label={label} />
      </div>
      <p className="pf-mono" style={{ textAlign: 'center', fontSize: 'clamp(44px,12vw,72px)', fontWeight: 700, lineHeight: 1 }}>
        <span style={{ color: 'var(--pf-red-text)' }}>{winsA}</span><span style={{ color: '#4A5B78' }}> – </span><span style={{ color: 'var(--pf-blue-text)' }}>{winsB}</span>
      </p>
      <p style={{ textAlign: 'center', marginTop: 8, fontWeight: 700 }}>
        <Link href={`/jugador/${pa.alias}`}>{pa.alias}</Link> <span className="pf-mono" style={{ color: 'var(--pf-faint)', fontWeight: 500 }}>{pa.elo_single}</span>
        <span style={{ color: 'var(--pf-faint)' }}> · </span>
        <Link href={`/jugador/${pb.alias}`}>{pb.alias}</Link> <span className="pf-mono" style={{ color: 'var(--pf-faint)', fontWeight: 500 }}>{pb.elo_single}</span>
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', margin: '16px 0 28px' }}>
        <span className="pf-chip">{t('headToHead', { total: r.total })}</span>
        {r.streak_owner && (r.streak_len ?? 0) >= 2 ? <span className="pf-chip">{t('streak', { alias: r.streak_owner === pa.id ? pa.alias : pb.alias, n: r.streak_len ?? 0 })}</span> : null}
        <span className="pf-chip">{t('eloGap', { n: Math.abs(pa.elo_single - pb.elo_single) })}</span>
        <span className="pf-chip pf-chip-nemesis">{t('roles', { crow: crow.alias, snake: snake.alias })}</span>
      </div>
      {fmt.length ? (
        <section style={{ marginBottom: 28 }}>
          <h2 className="pf-label" style={{ marginBottom: 10 }}>{t('byFormat')}</h2>
          <div className="pf-pillgrid" role="list">
            {fmt.map((k) => {
              const v = r.by_format[k]!;
              const mine = pa.id === r.player_low ? v.low : v.high;
              const theirs = pa.id === r.player_low ? v.high : v.low;
              return (
                <div key={k} role="listitem" className="pf-card" style={{ padding: '10px 6px', textAlign: 'center', borderRadius: 14 }}>
                  <div style={{ color: 'var(--pf-muted)', fontSize: 12 }}>{t('toPoints', { n: k })}</div>
                  <div className="pf-mono" style={{ fontWeight: 700, fontSize: 18 }}>{mine}–{theirs}</div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
      <section>
        <h2 className="pf-label" style={{ marginBottom: 10 }}>{t('lastMatches')}</h2>
        <MatchList matches={shared} players={recent.players} perspective={pa.id} />
      </section>
      {asking ? (
        <div style={{ position: 'sticky', bottom: 0, padding: '16px 0', background: 'linear-gradient(transparent, var(--pf-bg) 40%)' }}>
          <Link href={`/apuntar?rival=${encodeURIComponent(asking.alias)}`} className="pf-btn pf-btn-primary" style={{ width: '100%' }}>{t('rematch', { alias: asking.alias })}</Link>
        </div>
      ) : null}
    </div>
  );
}
