import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('errors');
  return (
    <div className="pf-container" style={{ padding: '96px 20px', textAlign: 'center' }}>
      <p className="pf-label">404</p>
      <h1 className="pf-display" style={{ fontSize: 'clamp(40px,7vw,72px)', margin: '12px 0 16px' }}>{t('notFoundTitle')}</h1>
      <p style={{ color: 'var(--pf-muted)', marginBottom: 28 }}>{t('notFoundBody')}</p>
      <Link href="/" className="pf-btn pf-btn-primary">{t('backHome')}</Link>
    </div>
  );
}
