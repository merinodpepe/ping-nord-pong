import { getLocale, getTranslations } from 'next-intl/server';

type Point = { confirmed_at: string; elo_after: number };

/** Gráfico de ELO en SVG propio (sin librerías). Con menos de 2 puntos no hay gráfico: estado vacío. */
export async function EloChart({ points, start = 1000 }: { points: Point[]; start?: number }) {
  const t = await getTranslations('profile');
  const locale = await getLocale();
  if (points.length < 1) return <p style={{ color: 'var(--pf-muted)' }}>{t('chartEmpty')}</p>;
  const ys = [start, ...points.map((p) => p.elo_after)];
  const min = Math.min(...ys), max = Math.max(...ys);
  const pad = Math.max(10, Math.round((max - min) * 0.15));
  const lo = min - pad, hi = max + pad;
  const W = 640, H = 220, L = 44, R = 12, T = 12, B = 24;
  const x = (i: number) => L + (i / Math.max(1, ys.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const d = ys.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const last = ys[ys.length - 1]!;
  const df = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('chartLabel', { from: start, to: last, n: points.length })} style={{ width: '100%', height: 'auto' }}>
      {[min, start, max].filter((v, i, a) => a.indexOf(v) === i).map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--pf-line)" strokeDasharray={v === start ? '4 6' : undefined} />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--pf-faint)" fontFamily="var(--font-mono)">{v}</text>
        </g>
      ))}
      <path d={d} fill="none" stroke="var(--pf-ball)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(ys.length - 1)} cy={y(last)} r="5" fill="var(--pf-ball)" />
      <text x={L} y={H - 4} fontSize="11" fill="var(--pf-faint)" fontFamily="var(--font-mono)">{df.format(new Date(points[0]!.confirmed_at))}</text>
      <text x={W - R} y={H - 4} textAnchor="end" fontSize="11" fill="var(--pf-faint)" fontFamily="var(--font-mono)">{df.format(new Date(points[points.length - 1]!.confirmed_at))}</text>
    </svg>
  );
}
