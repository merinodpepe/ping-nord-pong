import { NextResponse, type NextRequest } from 'next/server';
import { SITE_URL } from '@/lib/env';
import { locales } from '@/i18n/routing';
import { supabaseServer } from '@/lib/supabase/server';

// El enlace del email solo REDIRIGE a /[locale]/confirmar. El token se consume al pulsar el botón
// (Server Action), así los escáneres de enlaces / prefetch del correo no lo gastan.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const asked = url.searchParams.get('locale') ?? 'es';
  const locale = (locales as readonly string[]).includes(asked) ? asked : 'es';

  // Enlace "Confirm signup" por defecto de Supabase (PKCE): llega con ?code=. Se canjea aquí para
  // que un usuario nuevo nunca vuelva al formulario de email por un enlace que ya es válido.
  const code = url.searchParams.get('code');
  if (code && code.length <= 200) {
    const rawNext = url.searchParams.get('next') ?? '/';
    const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';
    const sb = await supabaseServer();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL(`/${locale}/entrar?error=link`, SITE_URL));
    const { data: u } = await sb.auth.getUser();
    const { data: p } = u.user ? await sb.from('profiles').select('id').eq('id', u.user.id).maybeSingle() : { data: null };
    const target = p ? (next === '/' ? `/${locale}` : `/${locale}${next}`) : `/${locale}/bienvenida?next=${encodeURIComponent(next)}`;
    return NextResponse.redirect(new URL(target, SITE_URL));
  }

  const dest = new URL(`/${locale}/confirmar`, SITE_URL);
  for (const k of ['token_hash', 'type', 'next']) {
    const v = url.searchParams.get(k);
    if (v) dest.searchParams.set(k, v);
  }
  return NextResponse.redirect(dest);
}
