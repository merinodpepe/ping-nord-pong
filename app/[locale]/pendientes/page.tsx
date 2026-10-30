import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ConfirmButtons } from '@/components/PendingActions';
import { Countdown } from '@/components/Countdown';
import { CopyLink } from '@/components/CopyLink';
import { Empty } from '@/components/Empty';
import { requireProfile } from '@/lib/guard';
import { supabaseServer } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/env';

type PM = { id: string; mode: string; points_target: number; best_of: number; status: string; created_by: string; expires_at: string; created_at: string; reject_reason: string | null; counter_of: string | null };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'pending' }))('title') };
}

export default async function PendingPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ m?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { m: highlight } = await searchParams;
  const me = await requireProfile('/pendientes');
  const t = await getTranslations('pending');
  const f = await getFormatter();
  const sb = await supabaseServer();
  const { data: ms } = await sb.from('matches').select('id, mode, points_target, best_of, status, created_by, expires_at, created_at, reject_reason, counter_of')
    .in('status', ['pending', 'rejected', 'expired']).order('created_at', { ascending: false }).limit(60);
  const matches = (ms ?? []) as PM[];
  const ids = matches.map((x) => x.id);
  const [{ data: pls }, { data: sets }] = ids.length
    ? await Promise.all([
        sb.from('match_players').select('match_id, team, profile_id').in('match_id', ids),
        sb.from('match_sets').select('match_id, set_no, score_a, score_b').in('match_id', ids).order('set_no'),
      ])
    : [{ data: [] }, { data: [] }];
  const profileIds = [...new Set((pls ?? []).map((p) => p.profile_id).filter(Boolean))] as string[];
  const { data: names } = profileIds.length ? await sb.from('public_profiles').select('id, alias').in('id', profileIds) : { data: [] };
  const alias = new Map((names ?? []).map((n) => [n.id as string, n.alias as string]));
  // eslint-disable-next-line react-hooks/purity -- página de servidor: se evalúa una vez por petición
  const now = Date.now();
  const toConfirm = matches.filter((x) => x.status === 'pending' && x.created_by !== me.id && new Date(x.expires_at).getTime() > now);
  const sent = matches.filter((x) => x.created_by === me.id && x.status === 'pending' && new Date(x.expires_at).getTime() > now);
  const closed = matches.filter((x) => !toConfirm.includes(x) && !sent.includes(x));

  const Card = ({ x, children }: { x: PM; children: React.ReactNode }) => {
    const p = (pls ?? []).filter((r) => r.match_id === x.id);
    const side = (team: string) => p.filter((r) => r.team === team).map((r) => alias.get(r.profile_id as string) ?? t('deleted')).join(' + ');
    const ss = (sets ?? []).filter((s) => s.match_id === x.id);
    return (
      <li id={x.id} className="pf-card" style={{ padding: 18, display: 'grid', gap: 10, outline: highlight === x.id ? '2px solid var(--pf-ball)' : undefined }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <strong>{side('A')} <span style={{ color: 'var(--pf-faint)', fontWeight: 500 }}>{t('vs')}</span> {side('B')}</strong>
          <span className="pf-chip">{x.mode} · {t('format', { points: x.points_target, bestOf: x.best_of })}</span>
          <span className="pf-mono" style={{ marginLeft: 'auto' }}>
            {ss.map((s, i) => <span key={i} style={{ marginLeft: 8 }}><span style={{ color: 'var(--pf-red-text)' }}>{s.score_a}</span>-<span style={{ color: 'var(--pf-blue-text)' }}>{s.score_b}</span></span>)}
          </span>
        </div>
        {children}
        <span style={{ color: 'var(--pf-faint)', fontSize: 12 }}>{f.dateTime(new Date(x.created_at), { dateStyle: 'medium', timeStyle: 'short' })}</span>
      </li>
    );
  };
  return (
    <div className="pf-container" style={{ paddingTop: 40, maxWidth: 760, display: 'grid', gap: 32 }}>
      <header>
        <p className="pf-label">{t('label')}</p>
        <h1 className="pf-display" style={{ fontSize: 'clamp(32px,6vw,48px)', margin: '8px 0' }}>{t('title')}</h1>
      </header>

      <section aria-labelledby="h-confirm">
        <h2 id="h-confirm" className="pf-display" style={{ fontSize: 24, marginBottom: 12 }}>{t('toConfirm')}</h2>
        {toConfirm.length ? (
          <ul style={{ display: 'grid', gap: 12 }}>
            {toConfirm.map((x) => {
              const creator = alias.get(x.created_by) ?? '';
              return (
                <Card key={x.id} x={x}>
                  <p style={{ color: 'var(--pf-text-2)' }}>{t('askedBy', { alias: creator })} · <Countdown to={x.expires_at} /></p>
                  <ConfirmButtons id={x.id} counterAlias={creator} />
                </Card>
              );
            })}
          </ul>
        ) : <Empty title={t('emptyConfirmTitle')}>{t('emptyConfirmBody')}</Empty>}
      </section>

      <section aria-labelledby="h-sent">
        <h2 id="h-sent" className="pf-display" style={{ fontSize: 24, marginBottom: 12 }}>{t('sent')}</h2>
        {sent.length ? (
          <ul style={{ display: 'grid', gap: 12 }}>
            {sent.map((x) => (
              <Card key={x.id} x={x}>
                <p style={{ color: 'var(--pf-text-2)' }}>{t('waiting')} · <Countdown to={x.expires_at} /></p>
                <div><CopyLink value={`${SITE_URL}/${locale}/pendientes?m=${x.id}`} /></div>
              </Card>
            ))}
          </ul>
        ) : <p style={{ color: 'var(--pf-muted)' }}>{t('emptySent')} <Link href="/apuntar" style={{ color: 'var(--pf-ball-hi)' }}>{t('recordOne')}</Link></p>}
      </section>

      {closed.length ? (
        <section aria-labelledby="h-closed">
          <h2 id="h-closed" className="pf-display" style={{ fontSize: 24, marginBottom: 12 }}>{t('closed')}</h2>
          <ul style={{ display: 'grid', gap: 12 }}>
            {closed.map((x) => (
              <Card key={x.id} x={x}>
                <p style={{ color: 'var(--pf-muted)' }}>
                  {x.status === 'expired' || (x.status === 'pending' && new Date(x.expires_at).getTime() <= now) ? t('statusExpired') : t('statusRejected', { reason: t(`reason_${x.reject_reason ?? 'other'}`) })}
                </p>
              </Card>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
