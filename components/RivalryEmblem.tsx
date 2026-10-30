'use client';
import { useEffect, useMemo, useState } from 'react';
import { EMBLEM_VIEWBOX, pfBadges, pfColors, pfEmblem, type Badge, type Shape } from '@/lib/emblem';

type Props = {
  crowIni: string;
  snakeIni: string;
  state: number;
  /** Estado anterior (rivalry_meta.prev_state): si difiere, se anima el cambio la primera vez que se ve. */
  prevState?: number | null;
  seed: number;
  size?: number;
  label: string;
};

function Layer({ shapes, badges }: { shapes: Shape[]; badges: Badge[] }) {
  return (
    <>
      {shapes.map((s, i) => (
        <path key={i} d={s.d} fill={s.fill} stroke={s.stroke} strokeWidth={s.sw} opacity={s.op} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {badges.map((b, i) => (
        <g key={i} opacity={b.op}>
          <circle cx={b.x} cy={b.y} r={b.r} fill="#0A1020" stroke={b.ring} strokeWidth={3} />
          <text x={b.x} y={b.ty} textAnchor="middle" fontFamily="Manrope, sans-serif" fontWeight={800} fontSize={b.fs} fill="#F2F5FA">{b.ini}</text>
        </g>
      ))}
    </>
  );
}

/** Emblema cuervo contra serpiente. Genera ~300 paths, así que se memoiza por (estado, semilla). Plan 3.6. */
export function RivalryEmblem({ crowIni, snakeIni, state, prevState, seed, size = 400, label }: Props) {
  const build = (st: number) => {
    const col = pfColors(seed);
    const em = pfEmblem(st, col);
    return { shapes: em.shapes, badges: pfBadges(st, em, crowIni, snakeIni, col) };
  };
  const now = useMemo(() => build(state), [state, seed, crowIni, snakeIni]); // eslint-disable-line react-hooks/exhaustive-deps
  const [animate, setAnimate] = useState(false);
  const [done, setDone] = useState(false);
  const changed = prevState != null && prevState !== state;
  const flip = changed && Math.sign(prevState!) !== Math.sign(state) && prevState !== 0 && state !== 0;
  const prev = useMemo(() => (changed ? build(prevState!) : null), [changed, prevState, seed, crowIni, snakeIni]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!changed) return;
    const key = `pnp:emblem:${seed}:${state}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch {
      /* sin almacenamiento: se anima igualmente */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- depende de localStorage (solo cliente)
    setAnimate(true);
  }, [changed, seed, state]);

  return (
    <svg
      viewBox={EMBLEM_VIEWBOX}
      width={size}
      height={Math.round((size * 4) / 3)}
      role="img"
      aria-label={label}
      style={{ maxWidth: '100%', height: 'auto', overflow: 'visible' }}
    >
      <g className="pf-breathe">
        {animate && !done && prev ? (
          <g style={{ animation: 'pfFadeOut .6s ease-in both' }} onAnimationEnd={() => setDone(true)}>
            <Layer shapes={prev.shapes} badges={prev.badges} />
          </g>
        ) : null}
        <g className={animate && !done ? 'pf-emblem-in' : undefined} style={{ transformOrigin: '200px 230px', transformBox: 'view-box' as never }}>
          <Layer shapes={now.shapes} badges={now.badges} />
        </g>
        {animate && flip ? <rect x={-10} y={-50} width={420} height={560} fill="#FF7A1A" className="pf-emblem-flash" pointerEvents="none" /> : null}
      </g>
      <style>{`@keyframes pfFadeOut { from { opacity: 1 } to { opacity: 0 } }`}</style>
    </svg>
  );
}
