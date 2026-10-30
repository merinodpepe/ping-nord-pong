'use client';
import { useTranslations } from 'next-intl';

export function FormError({ error }: { error?: string | null }) {
  const t = useTranslations('errors');
  if (!error) return null;
  return (
    <p role="alert" style={{ color: 'var(--pf-red-text)', fontWeight: 600, marginTop: 8 }}>
      {t.has(error) ? t(error) : t('generic')}
    </p>
  );
}
