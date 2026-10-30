import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ChallengeForm } from '@/components/ChallengeForm';
import { requireProfile } from '@/lib/guard';

export default async function NewChallenge({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ a?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { a } = await searchParams;
  await requireProfile('/retos/nuevo');
  const t = await getTranslations('challenges');
  return (
    <div className="pf-container" style={{ paddingTop: 40, maxWidth: 520 }}>
      <p className="pf-label">{t('label')}</p>
      <h1 className="pf-display" style={{ fontSize: 'clamp(32px,6vw,48px)', margin: '8px 0 20px' }}>{t('newTitle')}</h1>
      <ChallengeForm initialAlias={a ?? ''} />
    </div>
  );
}
