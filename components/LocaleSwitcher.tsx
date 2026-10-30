'use client';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { localeNames, locales, type Locale } from '@/i18n/routing';

export function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const locale = useLocale() as Locale;
  const t = useTranslations('nav');
  const pathname = usePathname();
  const router = useRouter();
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span className="sr-only-focusable" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{t('language')}</span>
      <select
        className="pf-field"
        aria-label={t('language')}
        value={locale}
        onChange={(e) => router.replace(pathname, { locale: e.target.value as Locale })}
        style={{ minHeight: 44, width: 'auto', padding: compact ? '6px 10px' : '8px 14px', fontWeight: 700, fontSize: 14, borderRadius: 999 }}
      >
        {locales.map((l) => (
          <option key={l} value={l} lang={l}>{localeNames[l]}</option>
        ))}
      </select>
    </label>
  );
}
