import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { ChallengeActions } from '@/components/ChallengeActions';
import { ChatBox } from '@/components/ChatBox';
import { Link } from '@/i18n/navigation';
import { requireProfile } from '@/lib/guard';
import { supabaseServer } from '@/lib/supabase/server';

export default async function ChallengePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const me = await requireProfile(`/retos/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const t = await getTranslations('challenges');
  const f = await getFormatter();
  const sb = await supabaseServer();
  const { data: c } = await sb.from('challenges').select('*').eq('id', id).maybeSingle();
  if (!c) notFound();
  const otherId = (c.from_id === me.id ? c.to_id : c.from_id) as string;
  const { data: names } = await sb.from('public_profiles').select('id, alias').in('id', [c.from_id, c.to_id]);
  const nm: Record<string, string> = Object.fromEntries((names ?? []).map((n) => [n.id as string, n.alias as string]));
  const { data: msgs } = await sb.from('messages').select('id, sender_id, body, flagged, created_at').eq('challenge_id', id).order('id').limit(300);
  // eslint-disable-next-line react-hooks/purity -- página de servidor: se evalúa una vez por petición
  const writable = c.status === 'open' || c.status === 'accepted' || (c.status === 'done' && c.closed_at && Date.now() - new Date(c.closed_at).getTime() < 7 * 864e5);
  return (
    <div className="pf-container" style={{ paddingTop: 32, maxWidth: 720, display: 'grid', gap: 20 }}>
      <Link href="/retos" style={{ color: 'var(--pf-muted)', textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>← {t('title')}</Link>
      <header>
        <h1 className="pf-display" style={{ fontSize: 'clamp(30px,5vw,44px)' }}>{nm[c.from_id as string] ?? '?'} <span style={{ color: 'var(--pf-faint)', fontWeight: 500 }}>→</span> {nm[c.to_id as string] ?? '?'}</h1>
        <p style={{ color: 'var(--pf-text-2)', marginTop: 6 }}>
          <span className="pf-chip">{t(`status_${c.status}`)}</span>{' '}
          {c.proposed_at ? f.dateTime(new Date(c.proposed_at), { dateStyle: 'full', timeStyle: 'short' }) : t('noDate')}
          {c.place ? ` · ${c.place}` : ''} · {c.mode}
        </p>
      </header>
      <ChallengeActions id={id} canRespond={c.status === 'open' && c.to_id === me.id} canCancel={c.status === 'open' || c.status === 'accepted'} otherId={otherId} />
      {c.status === 'accepted' ? <Link href={`/apuntar?rival=${encodeURIComponent(nm[otherId] ?? '')}&challenge=${id}`} className="pf-btn pf-btn-primary">{t('recordResult')}</Link> : null}
      <ChatBox challengeId={id} me={me.id} names={nm} initial={(msgs ?? []) as never} writable={Boolean(writable)} />
    </div>
  );
}
