import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link, redirect } from '@/i18n/navigation';
import { MagicLinkForm } from '@/components/MagicLinkForm';
import { getSession } from '@/lib/session';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'auth' }))('title') };
}

export default async function EnterPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string; error?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const { user, profile } = await getSession();
  if (user && profile) redirect({ href: sp.next?.startsWith('/') ? sp.next : '/', locale });
  const t = await getTranslations('auth');
  return (
    <div className="pf-container" style={{ paddingTop: 64, maxWidth: 520 }}>
      <p className="pf-label">{t('label')}</p>
      <h1 className="pf-display" style={{ fontSize: 'clamp(34px,6vw,54px)', margin: '8px 0 12px' }}>{t('title')}</h1>
      <p style={{ color: 'var(--pf-text-2)', marginBottom: 24 }}>{t('lead')}</p>
      {sp.error ? <p role="alert" style={{ color: 'var(--pf-red-text)', fontWeight: 600, marginBottom: 16 }}>{t('linkError')}</p> : null}
      {user && !profile ? <Link href="/bienvenida" className="pf-btn pf-btn-primary">{t('finish')}</Link> : <MagicLinkForm next={sp.next} />}
    </div>
  );
}
