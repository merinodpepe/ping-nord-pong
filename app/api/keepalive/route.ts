import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Ping principal anti-pausa de Supabase (plan, sección 14.4). Vercel Cron lo llama 1 vez al día con CRON_SECRET.
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  // 1) escritura real   2) lectura real de una tabla de la app
  const { data, error } = await sb.rpc('keepalive_ping', { p_source: 'vercel' });
  const { error: e2 } = await sb.from('profiles').select('id', { head: true, count: 'exact' }).limit(1);
  // 3) mantenimiento: caducar partidos pendientes (respaldo de pg_cron), purgas y reputación
  await sb.rpc('expire_pending_matches');
  if (error || e2) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true, last_ping: data });
}
