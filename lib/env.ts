// Variables de entorno. Nada de servidor se importa desde componentes cliente.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
export const TERMS_VERSION = process.env.TERMS_VERSION ?? '2026-11-01';
export const CONTACT_EMAIL = process.env.CONTACT_EMAIL ?? 'contacto@ping-nord-pong.example';
export const hasSupabase = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
