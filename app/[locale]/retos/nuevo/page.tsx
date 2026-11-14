import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ChallengeForm } from '@/components/ChallengeForm';
import { getProfileByAlias } from '@/lib/data';
import { requireProfile } from '@/lib/guard';

export default async function NewChallenge({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ a?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { a } = await searchParams;
  await requireProfile('/retos/nuevo');
  const target = a ? await getProfileByAlias(a) : null;
  const t = await getTranslations('challenges');
  return (
    <div className="pf-container" style={{ paddingTop: 40, maxWidth: 520 }}>
      <p className="pf-label">{t('label')}</p>
      <h1 className="pf-display" style={{ fontSize: 'clamp(32px,6vw,48px)', margin: '8px 0 20px' }}>{t('newTitle')}</h1>
      <ChallengeForm initial={target ? { id: target.id, alias: target.alias, tag: target.tag, color: target.avatar_color } : null} />
    </div>
  );
}
