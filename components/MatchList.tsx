import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { MatchPlayer, MatchRow } from '@/lib/data';

/** Últimos partidos. Desde `perspective` se muestra el delta y "por qué subí 9 y no 18" (K · w · m). */
export async function MatchList({ matches, players, perspective }: { matches: MatchRow[]; players: MatchPlayer[]; perspective?: string }) {
  const t = await getTranslations('match');
  const f = await getFormatter();
  if (!matches.length) return <p style={{ color: 'var(--pf-muted)' }}>{t('none')}</p>;
  return (
    <ul style={{ display: 'grid', gap: 10 }}>
      {matches.map((m) => {
        const ps = players.filter((p) => p.match_id === m.id);
        const me = ps.find((p) => p.profile_id === perspective);
        const side = (team: 'A' | 'B') =>
          ps.filter((p) => p.team === team).map((p) => p.alias ?? t('deletedPlayer'));
        const won = me ? me.team === m.winner_team : null;
        return (
          <li key={m.id} className="pf-card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'center' }}>
              <span className="pf-mono" style={{ color: 'var(--pf-faint)', fontSize: 12 }}>{f.dateTime(new Date(m.confirmed_at), { day: 'numeric', month: 'short' })}</span>
              <span style={{ fontWeight: 700 }}>
                {side('A').map((a, i) => (
                  <span key={i}>{i ? ' + ' : ''}{ps.find((p) => p.alias === a)?.alias ? <Link href={`/jugador/${a}`}>{a}</Link> : a}</span>
                ))}
                <span style={{ color: 'var(--pf-faint)', fontWeight: 500 }}> {t('vs')} </span>
                {side('B').map((a, i) => (
                  <span key={i}>{i ? ' + ' : ''}{ps.find((p) => p.alias === a)?.alias ? <Link href={`/jugador/${a}`}>{a}</Link> : a}</span>
                ))}
              </span>
              <span className="pf-mono" style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
                {m.sets.map(([a, b], i) => (
                  <span key={i}>
                    <span style={{ color: 'var(--pf-red-text)' }}>{a}</span>
                    <span style={{ color: '#4A5B78' }}>-</span>
                    <span style={{ color: 'var(--pf-blue-text)' }}>{b}</span>
                  </span>
                ))}
              </span>
              <span className="pf-chip">{t('format', { points: m.points_target, bestOf: m.best_of })}</span>
              {me && me.delta != null ? (
                <span className="pf-mono" style={{ fontWeight: 700, color: me.delta >= 0 ? 'var(--pf-win)' : 'var(--pf-red-text)' }}>
                  {won ? t('won') : t('lost')} {me.delta > 0 ? `+${me.delta}` : me.delta}
                </span>
              ) : null}
            </div>
            {me && me.k != null ? (
              <details style={{ marginTop: 6 }}>
                <summary style={{ color: 'var(--pf-muted)', fontSize: 13, cursor: 'pointer', minHeight: 24 }}>{t('why')}</summary>
                <p style={{ color: 'var(--pf-text-2)', fontSize: 14, marginTop: 6 }}>
                  {t('whyBody', { k: me.k, w: Number(me.weight_w).toFixed(2), m: Number(me.weight_m).toFixed(2), before: me.elo_before ?? 0, after: me.elo_after ?? 0 })}
                </p>
              </details>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
