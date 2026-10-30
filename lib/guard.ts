import 'server-only';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { hasSupabase } from '@/lib/env';
import { getSession } from '@/lib/session';

/** Páginas de usuario: sin sesión → /entrar, sin perfil → /bienvenida. La comprobación es siempre en el servidor. */
export async function requireProfile(next: string) {
  const locale = await getLocale();
  if (!hasSupabase()) redirect({ href: '/entrar', locale });
  const { user, profile } = await getSession();
  if (!user) redirect({ href: { pathname: '/entrar', query: { next } }, locale });
  if (!profile) redirect({ href: { pathname: '/bienvenida', query: { next } }, locale });
  return profile!;
}

export async function requireMod(next: string) {
  const p = await requireProfile(next);
  if (p.role !== 'mod' && p.role !== 'admin') redirect({ href: '/', locale: await getLocale() });
  return p;
}
