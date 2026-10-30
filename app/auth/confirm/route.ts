import { NextResponse, type NextRequest } from 'next/server';
import { SITE_URL } from '@/lib/env';
import { supabaseServer } from '@/lib/supabase/server';
import { locales } from '@/i18n/routing';

// Enlace del email: /auth/confirm?token_hash=…&type=email. Funciona aunque se abra en otro navegador (no usa PKCE).
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as 'email' | 'magiclink' | 'signup' | null;
  const next = url.searchParams.get('next') ?? '/';
  const asked = url.searchParams.get('locale') ?? 'es';
  const locale = (locales as readonly string[]).includes(asked) ? asked : 'es';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  const to = (path: string) => NextResponse.redirect(new URL(`/${locale}${path === '/' ? '' : path}`, SITE_URL));

  if (!tokenHash || !type) return to('/entrar?error=link');
  const sb = await supabaseServer();
  const { error } = await sb.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return to('/entrar?error=link');
  const { data: u } = await sb.auth.getUser();
  const { data: p } = u.user ? await sb.from('profiles').select('id, locale').eq('id', u.user.id).maybeSingle() : { data: null };
  if (!p) return to(`/bienvenida?next=${encodeURIComponent(safeNext)}`);
  return to(safeNext);
}
