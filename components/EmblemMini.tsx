import { pfColors } from '@/lib/emblem';

/** Por debajo de 120 px no se usa el emblema completo: cabeza de cuervo o de serpiente con el color de la pareja. */
export function EmblemMini({ role, seed, size = 28, label }: { role: 'crow' | 'snake'; seed: number; size?: number; label: string }) {
  const c = pfColors(seed);
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} role="img" aria-label={label}>
      <circle cx="16" cy="16" r="15" fill="#0A1020" stroke={role === 'crow' ? c.ring1 : c.ring2} strokeWidth="2" />
      {role === 'crow' ? (
        <>
          <path d="M8 19c0-6 4-10 9-10 3 0 5 1 6 3l5 3-5 1c-1 3-4 5-8 5-4 0-7-1-7-2z" fill={c.c1} stroke={c.c0} strokeWidth="1" />
          <path d="M23 12l5 3-5 1z" fill={c.c3} />
          <circle cx="19" cy="14" r="1.6" fill={c.eye} />
        </>
      ) : (
        <>
          <path d="M7 21c0-7 4-11 10-11 4 0 7 3 7 6 0 4-3 6-8 6-5 0-9-1-9-1z" fill={c.s2} stroke={c.s0} strokeWidth="1" />
          <path d="M24 17l5 1m-5 0l5-3" stroke="#c4313a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <circle cx="18" cy="14" r="1.8" fill={c.eye2} />
          <path d="M18 12.6v2.8" stroke="#111" strokeWidth="1" />
        </>
      )}
    </svg>
  );
}
