import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { confirmLogin } from '@/app/actions';
import { AutoSubmit } from '@/components/AutoSubmit';

export const metadata = { robots: { index: false } };

export default async function ConfirmPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ token_hash?: string; type?: string; next?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  if (!sp.token_hash || !sp.type) redirect({ href: '/entrar?error=link', locale });
  const t = await getTranslations('auth');
  return (
    <div className="pf-container" style={{ paddingTop: 64, maxWidth: 520 }}>
      <h1 className="pf-display" style={{ fontSize: 'clamp(34px,6vw,54px)', margin: '8px 0 12px' }}>{t('confirmTitle')}</h1>
      <p style={{ color: 'var(--pf-text-2)', marginBottom: 24 }}>{t('confirmBody')}</p>
      <form action={confirmLogin}>
        <input type="hidden" name="token_hash" value={sp.token_hash} />
        <input type="hidden" name="type" value={sp.type} />
        <input type="hidden" name="next" value={sp.next ?? '/'} />
        <AutoSubmit />
        <button className="pf-btn pf-btn-primary" type="submit">{t('confirmButton')}</button>
      </form>
    </div>
  );
}
