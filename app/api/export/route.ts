import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Portabilidad (RGPD): descarga JSON con el perfil, partidos, retos y mensajes propios.
export async function GET() {
  const sb = await supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false }, { status: 401 });
  const { data, error } = await sb.rpc('export_my_data');
  if (error) return NextResponse.json({ ok: false }, { status: 400 });
  const body = JSON.stringify({ email: u.user.email, ...(data as object) }, null, 2);
  return new NextResponse(body, { headers: { 'content-type': 'application/json', 'content-disposition': 'attachment; filename="ping-nord-pong-datos.json"', 'cache-control': 'no-store' } });
}
