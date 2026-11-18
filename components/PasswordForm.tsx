'use client';
import { useActionState, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { loginWithPassword, registerWithPassword } from '@/app/actions';
import { Link, useRouter } from '@/i18n/navigation';
import type { ActionResult } from '@/lib/errors';
import { FormError } from './FormMessage';
import { Turnstile } from './Turnstile';

export function PasswordForm({ next }: { next?: string }) {
  const t = useTranslations('auth');
  const tob = useTranslations('onboarding');
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loginState, loginAction, loginPending] = useActionState<ActionResult | null, FormData>(loginWithPassword, null);
  const [regState, regAction, regPending] = useActionState<ActionResult<{ handle: string }> | null, FormData>(registerWithPassword, null);

  // Entrar bien: vamos al destino. Sin setState aquí (lint).
  useEffect(() => { if (loginState?.ok) router.replace(next?.startsWith('/') ? next : '/'); }, [loginState, next, router]);

  if (regState?.ok) {
    return (
      <div className="pf-card" role="status" style={{ padding: 24, display: 'grid', gap: 12 }}>
        <p className="pf-display" style={{ fontSize: 24 }}>{t('welcomeTitle')}</p>
        <p style={{ color: 'var(--pf-text-2)' }}>
          {t('handleSaveBody')} <strong style={{ fontFamily: 'var(--pf-font-mono, monospace)', color: 'var(--pf-text)' }}>{regState.data?.handle}</strong>
        </p>
        <Link href="/" className="pf-btn pf-btn-primary">{t('continue')}</Link>
      </div>
    );
  }

  const tabStyle = (on: boolean) => ({ flex: 1, minHeight: 44, fontWeight: 700, opacity: on ? 1 : 0.6 });

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div role="tablist" style={{ display: 'flex', gap: 8 }}>
        <button role="tab" aria-selected={mode === 'login'} className="pf-btn" style={tabStyle(mode === 'login')} onClick={() => setMode('login')} type="button">{t('modeLogin')}</button>
        <button role="tab" aria-selected={mode === 'register'} className="pf-btn" style={tabStyle(mode === 'register')} onClick={() => setMode('register')} type="button">{t('modeRegister')}</button>
      </div>

      {mode === 'login' ? (
        <form action={loginAction} style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
            {t('handle')}
            <input className="pf-field" name="handle" required autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder={t('handlePlaceholder')} maxLength={30} />
          </label>
          <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
            {t('password')}
            <input className="pf-field" type="password" name="password" required autoComplete="current-password" minLength={8} maxLength={72} />
          </label>
          <Turnstile action="login" />
          <button className="pf-btn pf-btn-primary" type="submit" disabled={loginPending}>{t('submitLogin')}</button>
          <FormError error={loginState && !loginState.ok ? loginState.error : null} />
        </form>
      ) : (
        <form action={regAction} style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
            {tob('alias')}
            <input className="pf-field" name="alias" required minLength={3} maxLength={20} pattern="[A-Za-z0-9._\-]{3,20}" autoComplete="nickname" autoCapitalize="none" spellCheck={false} aria-describedby="alias-help" />
            <span id="alias-help" style={{ color: 'var(--pf-faint)', fontSize: 13, fontWeight: 400 }}>{tob('aliasHelp')}</span>
          </label>
          <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
            {t('password')}
            <input className="pf-field" type="password" name="password" required autoComplete="new-password" minLength={8} maxLength={72} aria-describedby="pw-help" />
            <span id="pw-help" style={{ color: 'var(--pf-faint)', fontSize: 13, fontWeight: 400 }}>{t('passwordHelp')}</span>
          </label>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minHeight: 44 }}>
            <input type="checkbox" name="age" required style={{ width: 22, height: 22, marginTop: 2 }} />
            <span>{tob('age')}</span>
          </label>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minHeight: 44 }}>
            <input type="checkbox" name="terms" required style={{ width: 22, height: 22, marginTop: 2 }} />
            <span>
              {tob.rich('terms', {
                terms: (c) => <Link href="/legal/terminos" target="_blank" style={{ textDecoration: 'underline' }}>{c}</Link>,
                privacy: (c) => <Link href="/legal/privacidad" target="_blank" style={{ textDecoration: 'underline' }}>{c}</Link>,
              })}
            </span>
          </label>
          <Turnstile action="register" />
          <button className="pf-btn pf-btn-primary" type="submit" disabled={regPending}>{t('submitRegister')}</button>
          <FormError error={regState && !regState.ok ? regState.error : null} />
        </form>
      )}
    </div>
  );
}
