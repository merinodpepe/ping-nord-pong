import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from './LocaleSwitcher';

export async function Footer() {
  const t = await getTranslations('footer');
  const link = { color: 'var(--pf-muted)', textDecoration: 'none', padding: '10px 0', minHeight: 44, display: 'inline-flex', alignItems: 'center' } as const;
  return (
    <footer style={{ borderTop: '1px solid var(--pf-line)', marginTop: 64 }}>
      <div className="pf-container" style={{ padding: '32px 20px', display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px', alignItems: 'center' }}>
          <Link href="/legal/privacidad" style={link}>{t('privacy')}</Link>
          <Link href="/legal/terminos" style={link}>{t('terms')}</Link>
          <Link href="/legal/cookies" style={link}>{t('cookies')}</Link>
          <Link href="/normativa" style={link}>{t('rules')}</Link>
          <span style={{ marginLeft: 'auto' }}><LocaleSwitcher /></span>
        </div>
        <p style={{ color: 'var(--pf-muted)', fontSize: 13 }}>{t('disclaimer')}</p>
        <p style={{ color: 'var(--pf-faint)', fontSize: 12 }}>
          Ping-Nord-Pong · Campus Nord · {t('by')} <span>Pepe Flock</span> · {t('dataNote')}
        </p>
      </div>
    </footer>
  );
}
