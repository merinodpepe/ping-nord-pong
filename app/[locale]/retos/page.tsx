import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Empty } from '@/components/Empty';
import { requireProfile } from '@/lib/guard';
import { supabaseServer } from '@/lib/supabase/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'challenges' }))('title') };
}

export default async function ChallengesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireProfile('/retos');
  const t = await getTranslations('challenges');
  const f = await getFormatter();
  const sb = await supabaseServer();
  const { data } = await sb.from('challenges').select('*').order('created_at', { ascending: false }).limit(50);
  const list = data ?? [];
  const ids = [...new Set(list.flatMap((c) => [c.from_id, c.to_id]))] as string[];
  const { data: names } = ids.length ? await sb.from('public_profiles').select('id, alias').in('id', ids) : { data: [] };
  const alias = new Map((names ?? []).map((n) => [n.id as string, n.alias as string]));
  const active = list.filter((c) => c.status === 'open' || c.status === 'accepted');
  const past = list.filter((c) => !active.includes(c));
  const Row = ({ c }: { c: (typeof list)[number] }) => {
    const other = c.from_id === me.id ? c.to_id : c.from_id;
    return (
      <li>
        <Link href={`/retos/${c.id}`} className="pf-card" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 18px', textDecoration: 'none', minHeight: 64, flexWrap: 'wrap' }}>
          <strong>{alias.get(other) ?? t('deleted')}</strong>
          <span className="pf-chip">{t(`status_${c.status}`)}</span>
          {c.to_id === me.id && c.status === 'open' ? <span className="pf-chip pf-chip-nemesis">{t('toAnswer')}</span> : null}
          <span style={{ marginLeft: 'auto', color: 'var(--pf-muted)', fontSize: 14 }}>{c.proposed_at ? f.dateTime(new Date(c.proposed_at), { dateStyle: 'medium', timeStyle: 'short' }) : ''}</span>
        </Link>
      </li>
    );
  };
  return (
    <div className="pf-container" style={{ paddingTop: 40, maxWidth: 760, display: 'grid', gap: 28 }}>
      <header>
        <p className="pf-label">{t('label')}</p>
        <h1 className="pf-display" style={{ fontSize: 'clamp(32px,6vw,48px)', margin: '8px 0' }}>{t('title')}</h1>
        <p style={{ color: 'var(--pf-text-2)' }}>{t('lead')}</p>
      </header>
      {active.length ? <ul style={{ display: 'grid', gap: 10 }}>{active.map((c) => <Row key={c.id} c={c} />)}</ul> : <Empty title={t('emptyTitle')}>{t('emptyBody')} <Link href="/ranking" style={{ color: 'var(--pf-ball-hi)' }}>{t('pickRival')}</Link></Empty>}
      {past.length ? <section><h2 className="pf-display" style={{ fontSize: 22, marginBottom: 10 }}>{t('past')}</h2><ul style={{ display: 'grid', gap: 10 }}>{past.map((c) => <Row key={c.id} c={c} />)}</ul></section> : null}
    </div>
  );
}
