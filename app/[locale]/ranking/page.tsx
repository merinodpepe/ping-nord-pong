import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Empty } from '@/components/Empty';
import { RankingTable } from '@/components/RankingTable';
import { getRanking, type Mode } from '@/lib/data';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'ranking' });
  return { title: t('title') };
}

export default async function RankingPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ m?: string; s?: string; q?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const mode: Mode = sp.m === '2v2' ? '2v2' : '1v1';
  const scope = sp.s === 'all' ? 'all' : 'active';
  const q = (sp.q ?? '').slice(0, 20);
  const t = await getTranslations('ranking');
  const rows = await getRanking(mode, scope, q);
  const href = (o: { m?: string; s?: string }) => ({ pathname: '/ranking' as const, query: { m: o.m ?? mode, s: o.s ?? scope, ...(q ? { q } : {}) } });
  return (
    <div className="pf-container" style={{ paddingTop: 48 }}>
      <p className="pf-label">{t('label')}</p>
      <h1 className="pf-display" style={{ fontSize: 'clamp(36px,5vw,60px)', margin: '8px 0 24px' }}>{t('title')}</h1>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
        <div className="pf-seg" role="group" aria-label={t('mode')}>
          <Link href={href({ m: '1v1' })} aria-current={mode === '1v1' ? 'true' : undefined}>1v1</Link>
          <Link href={href({ m: '2v2' })} aria-current={mode === '2v2' ? 'true' : undefined}>2v2</Link>
        </div>
        <div className="pf-seg" role="group" aria-label={t('scope')}>
          <Link href={href({ s: 'active' })} aria-current={scope === 'active' ? 'true' : undefined}>{t('active')}</Link>
          <Link href={href({ s: 'all' })} aria-current={scope === 'all' ? 'true' : undefined}>{t('history')}</Link>
        </div>
        <form method="get" role="search" style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <input type="hidden" name="m" value={mode} /><input type="hidden" name="s" value={scope} />
          <label>
            <span className="sr-only-focusable">{t('search')}</span>
            <input className="pf-field" type="search" name="q" defaultValue={q} placeholder={t('search')} maxLength={20} style={{ width: 200 }} />
          </label>
          <button className="pf-btn pf-btn-secondary pf-btn-sm" type="submit">{t('searchBtn')}</button>
        </form>
      </div>
      {rows.length ? <RankingTable rows={rows} /> : <Empty title={t('emptyTitle')}>{q ? t('emptySearch') : t('emptyBody')}</Empty>}
      <p style={{ color: 'var(--pf-faint)', fontSize: 13, marginTop: 14 }}>{t('footnote')}</p>
    </div>
  );
}
