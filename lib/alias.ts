/** Alias con código tipo Discord: Furu#xyzj. En URLs se usa `Furu~xyzj` (la `~` no es válida en un alias). */
export const TAG_RE = /^[a-z0-9]{4}$/;

export const formatHandle = (alias: string, tag?: string | null) => (tag ? `${alias}#${tag}` : alias);
export const handleSlug = (alias: string, tag?: string | null) => (tag ? `${alias}~${tag}` : alias);

/** Acepta `alias~tag`, `alias#tag` (también codificado) o un alias suelto. */
export function parseHandle(input: string): { alias: string; tag: string | null } {
  let s = input;
  try { s = decodeURIComponent(input); } catch { /* se usa tal cual */ }
  s = s.trim();
  const m = /^(.+?)[~#]([A-Za-z0-9]{4})$/.exec(s);
  if (m && TAG_RE.test(m[2]!.toLowerCase())) return { alias: m[1]!, tag: m[2]!.toLowerCase() };
  return { alias: s.replace(/[~#].*$/, ''), tag: null };
}

/** Escapa los comodines de LIKE/ILIKE. */
export const escapeLike = (s: string) => s.replace(/[%_\\]/g, (c) => `\\${c}`);

export type PlayerOption = { id: string; alias: string; tag: string; color: number | null };
