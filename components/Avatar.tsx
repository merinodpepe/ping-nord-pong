import { avatarIndex, initials } from '@/lib/avatar';

export function Avatar({ id, alias, color, size = 36 }: { id: string; alias: string | null; color?: number | null; size?: number }) {
  const bg = `var(--pf-av-${avatarIndex(id, color)})`;
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: '50%', background: bg, color: 'var(--pf-bg)', display: 'inline-grid',
        placeItems: 'center', fontWeight: 800, fontSize: Math.round(size * 0.38), flex: 'none', fontFamily: 'var(--font-sans)',
      }}
    >
      {initials(alias)}
    </span>
  );
}
