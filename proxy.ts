import { createServerClient } from '@supabase/ssr';
import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intl = createIntlMiddleware(routing);

function csp(nonce: string): string {
  const dev = process.env.NODE_ENV !== 'production';
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const ws = supabase.replace(/^http/, 'ws');
  return [
    `default-src 'self'`,
    // Sin 'unsafe-inline' en scripts: solo el nonce de esta petición (y lo que esos scripts carguen)
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self' ${supabase} ${ws} https://challenges.cloudflare.com`.replace(/\s+/g, ' '),
    `frame-src https://challenges.cloudflare.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(dev ? [] : [`upgrade-insecure-requests`]),
  ].join('; ');
}

export default async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const policy = csp(nonce);
  request.headers.set('x-nonce', nonce);
  request.headers.set('content-security-policy', policy);

  const response = intl(request);

  // Renueva la sesión de Supabase (cookies httpOnly, Secure, SameSite=Lax) si hay una
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key && request.cookies.getAll().some((c) => c.name.startsWith('sb-'))) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
      },
    });
    await supabase.auth.getClaims();
  }

  response.headers.set('content-security-policy', policy);
  return response;
}

export const config = {
  matcher: ['/((?!api|auth|_next|_vercel|.*\\..*).*)'],
};
