import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MatchList } from '@/components/MatchList';
import { getPublicMatches } from '@/lib/data';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'matchesPage' }))('title') };
}

export default async function MatchesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('matchesPage');
  const { matches, players } = await getPublicMatches();
  return (
    <div className="pf-container" style={{ paddingTop: 48, maxWidth: 820 }}>
      <p className="pf-label">{t('label')}</p>
      <h1 className="pf-display" style={{ fontSize: 'clamp(36px,5vw,60px)', margin: '8px 0 8px' }}>{t('title')}</h1>
      <p style={{ color: 'var(--pf-text-2)', marginBottom: 24, maxWidth: '60ch' }}>{t('lead')}</p>
      <MatchList matches={matches} players={players} />
    </div>
  );
}
