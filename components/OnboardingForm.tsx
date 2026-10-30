'use client';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { completeOnboarding } from '@/app/actions';
import { Link } from '@/i18n/navigation';
import type { ActionResult } from '@/lib/errors';
import { FormError } from './FormMessage';

export function OnboardingForm({ next }: { next?: string }) {
  const t = useTranslations('onboarding');
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(completeOnboarding, null);
  return (
    <form action={action} style={{ display: 'grid', gap: 18 }}>
      <input type="hidden" name="next" value={next ?? '/'} />
      <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
        {t('alias')}
        <input className="pf-field" name="alias" required minLength={3} maxLength={20} pattern="[A-Za-z0-9._\-]{3,20}" autoComplete="nickname" autoCapitalize="none" spellCheck={false} aria-describedby="alias-help" />
        <span id="alias-help" style={{ color: 'var(--pf-faint)', fontSize: 13, fontWeight: 400 }}>{t('aliasHelp')}</span>
      </label>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minHeight: 44 }}>
        <input type="checkbox" name="age" required style={{ width: 22, height: 22, marginTop: 2 }} />
        <span>{t('age')}</span>
      </label>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minHeight: 44 }}>
        <input type="checkbox" name="terms" required style={{ width: 22, height: 22, marginTop: 2 }} />
        <span>
          {t.rich('terms', {
            terms: (c) => <Link href="/legal/terminos" target="_blank" style={{ textDecoration: 'underline' }}>{c}</Link>,
            privacy: (c) => <Link href="/legal/privacidad" target="_blank" style={{ textDecoration: 'underline' }}>{c}</Link>,
          })}
        </span>
      </label>
      <button className="pf-btn pf-btn-primary" type="submit" disabled={pending}>{t('submit')}</button>
      <FormError error={state && !state.ok ? state.error : null} />
    </form>
  );
}
