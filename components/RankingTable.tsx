import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { RankRow } from '@/lib/data';
import { Avatar } from './Avatar';

const MEDALS = ['var(--pf-gold)', 'var(--pf-silver)', 'var(--pf-bronze)'];

export async function RankingTable({ rows, showRetar = true }: { rows: RankRow[]; showRetar?: boolean }) {
  const t = await getTranslations('ranking');
  const locale = await getLocale();
  const nf = new Intl.NumberFormat(locale, { useGrouping: false });
  const sf = new Intl.NumberFormat(locale, { signDisplay: 'exceptZero' });
  // Los provisionales salen con su chip pero no puntúan para top 3 ni medallas
  let place = 0;
  return (
    <div className="pf-table-wrap">
      <table className="pf-table">
        <caption className="sr-only-focusable">{t('caption')}</caption>
        <thead>
          <tr>
            <th scope="col">#</th><th scope="col">{t('player')}</th><th scope="col">ELO</th>
            <th scope="col">{t('last7')}</th><th scope="col">{t('wl')}</th><th scope="col">{t('streak')}</th>
            <th scope="col"><span className="sr-only-focusable">{t('action')}</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const rank = r.is_provisional ? null : ++place;
            const d = r.delta7;
            return (
              <tr key={r.profile_id}>
                <td className="pf-mono" style={{ fontWeight: 700, color: rank && rank <= 3 ? MEDALS[rank - 1] : 'var(--pf-muted)' }}>{rank ?? '–'}</td>
                <td>
                  <Link href={`/jugador/${r.alias}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', minHeight: 44 }}>
                    <Avatar id={r.profile_id} alias={r.alias} color={r.avatar_color} />
                    <span style={{ fontWeight: 700 }}>{r.alias}</span>
                    {r.is_provisional ? <span className="pf-chip">{t('provisional')}</span> : null}
                  </Link>
                </td>
                <td className="pf-mono" style={{ fontSize: 18, fontWeight: 700 }}>{nf.format(r.elo)}</td>
                <td className="pf-mono" style={{ color: d > 0 ? 'var(--pf-win)' : d < 0 ? 'var(--pf-red-text)' : 'var(--pf-faint)' }}>{d === 0 ? '0' : sf.format(d)}</td>
                <td className="pf-mono">{r.wins}–{r.losses}</td>
                <td className="pf-mono" style={{ color: r.streak > 0 ? 'var(--pf-win)' : r.streak < 0 ? 'var(--pf-red-text)' : 'var(--pf-faint)' }}>
                  {r.streak === 0 ? '–' : `${r.streak > 0 ? 'W' : 'L'}${Math.abs(r.streak)}`}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {showRetar ? <Link href={`/retos/nuevo?a=${encodeURIComponent(r.alias)}`} className="pf-btn pf-btn-secondary pf-btn-sm">{t('challenge')}</Link> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
