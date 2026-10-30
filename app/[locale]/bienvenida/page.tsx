import { getTranslations, setRequestLocale } from 'next-intl/server';
import { OnboardingForm } from '@/components/OnboardingForm';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/session';

export default async function Welcome({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next } = await searchParams;
  const { user, profile } = await getSession();
  if (!user) redirect({ href: '/entrar', locale });
  if (profile) redirect({ href: next?.startsWith('/') ? next : '/', locale });
  const t = await getTranslations('onboarding');
  return (
    <div className="pf-container" style={{ paddingTop: 64, maxWidth: 520 }}>
      <p className="pf-label">{t('label')}</p>
      <h1 className="pf-display" style={{ fontSize: 'clamp(34px,6vw,54px)', margin: '8px 0 12px' }}>{t('title')}</h1>
      <p style={{ color: 'var(--pf-text-2)', marginBottom: 24 }}>{t('lead')}</p>
      <OnboardingForm next={next} />
    </div>
  );
}
