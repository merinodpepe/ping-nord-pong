/** Iniciales del alias para el avatar (sin fotos). */
export function initials(alias: string | null | undefined): string {
  if (!alias) return '?';
  const parts = alias.split(/[._-]+/).filter(Boolean);
  const s = parts.length > 1 ? parts[0]![0]! + parts[1]![0]! : alias.slice(0, 2);
  return s.toUpperCase();
}

/** Color estable por hash del id (no aleatorio en cada render). */
export function avatarIndex(id: string, stored?: number | null): number {
  if (typeof stored === 'number' && stored >= 0 && stored <= 6) return stored;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 7;
}
