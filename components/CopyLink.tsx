'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

export function CopyLink({ value }: { value: string }) {
  const t = useTranslations('common');
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="pf-btn pf-btn-secondary pf-btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setOk(true);
          setTimeout(() => setOk(false), 2000);
        } catch {
          window.prompt(t('copyLink'), value);
        }
      }}
    >
      <span aria-live="polite">{ok ? t('copied') : t('copyLink')}</span>
    </button>
  );
}
