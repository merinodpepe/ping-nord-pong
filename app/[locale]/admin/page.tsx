import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { FlagActions, ReportActions, ToolsPanel } from '@/components/AdminPanel';
import { requireMod } from '@/lib/guard';
import { supabaseServer } from '@/lib/supabase/server';

export const metadata = { title: 'Admin', robots: { index: false } };

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireMod('/admin'); // comprobación de rol en el servidor; las RPC la repiten en SQL
  const t = await getTranslations('admin');
  const f = await getFormatter();
  const sb = await supabaseServer();
  const [{ data: reports }, { data: flags }, { data: health }, { data: audit }] = await Promise.all([
    sb.from('reports').select('*').eq('status', 'open').order('created_at').limit(50),
    sb.from('auto_flags').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(50),
    sb.rpc('admin_health'),
    sb.from('audit_log').select('*').order('created_at', { ascending: false }).limit(30),
  ]);
  const ids = [...new Set([...(flags ?? []).flatMap((x) => [x.profile_a, x.profile_b]), ...(reports ?? []).flatMap((x) => [x.target_profile, x.reporter_id])].filter(Boolean))] as string[];
  const { data: names } = ids.length ? await sb.from('profiles').select('id, alias').in('id', ids) : { data: [] };
  const al = new Map((names ?? []).map((n) => [n.id as string, n.alias as string]));
  const h = (health ?? []) as { source: string; last_ping: string; age_hours: number }[];
  return (
    <div className="pf-container" style={{ paddingTop: 40, display: 'grid', gap: 36 }}>
      <header><p className="pf-label">{t('label')}</p><h1 className="pf-display" style={{ fontSize: 'clamp(32px,5vw,48px)' }}>{t('title')}</h1></header>
      <section aria-labelledby="h-health">
        <h2 id="h-health" className="pf-display" style={{ fontSize: 22, marginBottom: 10 }}>{t('health')}</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {h.map((x) => (
            <div key={x.source} className="pf-card" style={{ padding: 16, borderColor: Number(x.age_hours) < 36 ? 'var(--pf-win)' : 'var(--pf-red)' }}>
              <strong>{x.source}</strong>
              <div className="pf-mono">{t('ago', { h: x.age_hours })}</div>
              <div style={{ color: Number(x.age_hours) < 36 ? 'var(--pf-win)' : 'var(--pf-red-text)', fontWeight: 700 }}>{Number(x.age_hours) < 36 ? t('ok') : t('stale')}</div>
            </div>
          ))}
        </div>
      </section>
      <section aria-labelledby="h-rep">
        <h2 id="h-rep" className="pf-display" style={{ fontSize: 22, marginBottom: 10 }}>{t('reports')} ({reports?.length ?? 0})</h2>
        {(reports ?? []).length ? <ul style={{ display: 'grid', gap: 12 }}>{(reports ?? []).map((r) => (
          <li key={r.id} className="pf-card" style={{ padding: 16, display: 'grid', gap: 8 }}>
            <div><span className="pf-chip pf-chip-nemesis">{r.reason}</span> {r.target_profile ? `→ ${al.get(r.target_profile) ?? r.target_profile}` : ''} {r.target_match ? `match ${r.target_match}` : ''} {r.target_message ? `msg ${r.target_message}` : ''}</div>
            {r.details ? <p style={{ color: 'var(--pf-text-2)' }}>{r.details}</p> : null}
            <span style={{ color: 'var(--pf-faint)', fontSize: 12 }}>{al.get(r.reporter_id) ?? '—'} · {f.dateTime(new Date(r.created_at), { dateStyle: 'medium', timeStyle: 'short' })}</span>
            <ReportActions id={r.id} />
          </li>))}</ul> : <p style={{ color: 'var(--pf-muted)' }}>{t('noReports')}</p>}
      </section>
      <section aria-labelledby="h-flags">
        <h2 id="h-flags" className="pf-display" style={{ fontSize: 22, marginBottom: 10 }}>{t('flags')} ({flags?.length ?? 0})</h2>
        {(flags ?? []).length ? <ul style={{ display: 'grid', gap: 12 }}>{(flags ?? []).map((x) => (
          <li key={x.id} className="pf-card" style={{ padding: 16, display: 'grid', gap: 8 }}>
            <div><span className="pf-chip">{x.kind}</span> {al.get(x.profile_a) ?? '?'}{x.profile_b ? ` ↔ ${al.get(x.profile_b) ?? '?'}` : ''}</div>
            <code className="pf-mono" style={{ color: 'var(--pf-muted)', fontSize: 12 }}>{JSON.stringify(x.details)}</code>
            <FlagActions id={x.id} />
          </li>))}</ul> : <p style={{ color: 'var(--pf-muted)' }}>{t('noFlags')}</p>}
      </section>
      <section aria-labelledby="h-tools"><h2 id="h-tools" className="pf-display" style={{ fontSize: 22, marginBottom: 10 }}>{t('tools')}</h2><ToolsPanel /></section>
      <section aria-labelledby="h-audit">
        <h2 id="h-audit" className="pf-display" style={{ fontSize: 22, marginBottom: 10 }}>{t('audit')}</h2>
        <div className="pf-table-wrap"><table className="pf-table"><tbody>{(audit ?? []).map((a) => (
          <tr key={a.id}><td className="pf-mono" style={{ fontSize: 12 }}>{f.dateTime(new Date(a.created_at), { dateStyle: 'short', timeStyle: 'short' })}</td><td>{al.get(a.actor_id) ?? a.actor_id?.slice(0, 8) ?? 'sistema'}</td><td>{a.action}</td><td className="pf-mono" style={{ fontSize: 12 }}>{a.target}</td></tr>))}</tbody></table></div>
      </section>
    </div>
  );
}
