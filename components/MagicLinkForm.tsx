'use client';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { requestMagicLink } from '@/app/actions';
import { FormError } from './FormMessage';
import { Turnstile } from './Turnstile';
import type { ActionResult } from '@/lib/errors';

export function MagicLinkForm({ next }: { next?: string }) {
  const t = useTranslations('auth');
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(requestMagicLink, null);
  if (state?.ok) {
    return (
      <div className="pf-card" role="status" style={{ padding: 24 }}>
        <p className="pf-display" style={{ fontSize: 24, marginBottom: 8 }}>{t('sentTitle')}</p>
        <p style={{ color: 'var(--pf-text-2)' }}>{t('sentBody')}</p>
      </div>
    );
  }
  return (
    <form action={action} style={{ display: 'grid', gap: 14 }}>
      <input type="hidden" name="next" value={next ?? '/'} />
      <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
        {t('email')}
        <input className="pf-field" type="email" name="email" required autoComplete="email" inputMode="email" placeholder={t('emailPlaceholder')} maxLength={254} />
      </label>
      <Turnstile action="login" />
      <button className="pf-btn pf-btn-primary" type="submit" disabled={pending}>{pending ? t('sending') : t('send')}</button>
      <FormError error={state && !state.ok ? state.error : null} />
      <p style={{ color: 'var(--pf-faint)', fontSize: 13 }}>{t('neutral')}</p>
    </form>
  );
}
