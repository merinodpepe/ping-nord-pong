import { getTranslations, setRequestLocale } from 'next-intl/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'rules' }))('title') };
}

type Rule = { h: string; p: string };

export default async function RulesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('rules');
  const official = t.raw('official') as Rule[];
  const house = t.raw('house') as string[];
  return (
    <div className="pf-container" style={{ paddingTop: 48, maxWidth: 820 }}>
      <p className="pf-label">{t('label')}</p>
      <h1 className="pf-display" style={{ fontSize: 'clamp(36px,5vw,60px)', margin: '8px 0 12px' }}>{t('title')}</h1>
      <p style={{ color: 'var(--pf-text-2)', marginBottom: 28 }}>{t('lead')}</p>
      <ol style={{ display: 'grid', gap: 12, listStyle: 'none' }}>
        {official.map((r, i) => (
          <li key={i} className="pf-card" style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '40px 1fr', gap: 12 }}>
            <span className="pf-mono" style={{ color: 'var(--pf-ball-hi)', fontWeight: 700, fontSize: 20 }}>{i + 1}</span>
            <div><h2 style={{ fontWeight: 800, fontSize: 18 }}>{r.h}</h2><p style={{ color: 'var(--pf-text-2)' }}>{r.p}</p></div>
          </li>
        ))}
      </ol>
      <h2 className="pf-display" style={{ fontSize: 30, margin: '40px 0 12px' }}>{t('houseTitle')}</h2>
      <ul className="pf-prose" style={{ display: 'grid', gap: 8, listStyle: 'disc', paddingLeft: 22 }}>
        {house.map((h, i) => <li key={i} style={{ color: 'var(--pf-text-2)' }}>{h}</li>)}
      </ul>
      <p style={{ color: 'var(--pf-muted)', marginTop: 32, fontSize: 14 }}>
        {t('source')}{' '}
        <a href="https://www.ittf.com/handbook/" rel="noopener noreferrer" target="_blank" style={{ color: 'var(--pf-ball-hi)', textDecoration: 'underline' }}>ITTF Handbook</a> · {t('reviewed', { date: '2026-10-30' })}
      </p>
    </div>
  );
}
