import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CONTACT_EMAIL, TERMS_VERSION } from '@/lib/env';

type Sec = { h: string; p: string[] };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'legal.cookies' }))('title') };
}

export default async function LegalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('legal');
  const secs = t.raw('cookies.sections') as Sec[];
  return (
    <div className="pf-container pf-prose" style={{ paddingTop: 48, maxWidth: 820 }}>
      <p className="pf-label">{t('label')}</p>
      <h1 className="pf-display" style={{ fontSize: 'clamp(34px,5vw,54px)', margin: '8px 0 12px' }}>{t('cookies.title')}</h1>
      <p style={{ color: 'var(--pf-muted)', fontSize: 14 }}>{t('version', { v: TERMS_VERSION })}</p>
      <p role="note" className="pf-card" style={{ padding: '10px 16px', margin: '16px 0', color: 'var(--pf-text-2)' }}>{t('draft')}</p>
      {secs.map((s, i) => (
        <section key={i}><h2>{s.h}</h2>{s.p.map((p, j) => <p key={j}>{p.replace('{email}', CONTACT_EMAIL)}</p>)}</section>
      ))}
      <p style={{ marginTop: 32, color: 'var(--pf-muted)' }}>{t('prevails')}</p>
    </div>
  );
}
