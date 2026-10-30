'use client';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { deleteAccount, updateProfile } from '@/app/actions';
import { locales, localeNames } from '@/i18n/routing';
import type { ActionResult } from '@/lib/errors';
import { Avatar } from './Avatar';
import { FormError } from './FormMessage';

export function ProfileForm({ id, alias, color, locale }: { id: string; alias: string; color: number; locale: string }) {
  const t = useTranslations('settings');
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(updateProfile, null);
  return (
    <form action={action} style={{ display: 'grid', gap: 16 }}>
      <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>{t('alias')}
        <input className="pf-field" name="alias" defaultValue={alias} minLength={3} maxLength={20} pattern="[A-Za-z0-9._\-]{3,20}" autoCapitalize="none" /></label>
      <fieldset style={{ border: 0, padding: 0 }}>
        <legend style={{ fontWeight: 600, marginBottom: 8 }}>{t('color')}</legend>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[0, 1, 2, 3, 4, 5, 6].map((c) => (
            <label key={c} style={{ cursor: 'pointer' }}>
              <input type="radio" name="color" value={c} defaultChecked={c === color} style={{ position: 'absolute', opacity: 0 }} />
              <span style={{ display: 'inline-grid', padding: 3, borderRadius: '50%', border: '2px solid transparent', minWidth: 44, minHeight: 44, placeItems: 'center' }} className="pf-color-opt">
                <Avatar id={id} alias={alias} color={c} size={36} />
              </span>
              <span className="sr-only-focusable">{t('colorN', { n: c + 1 })}</span>
            </label>
          ))}
        </div>
        <style>{`input:checked + .pf-color-opt { border-color: var(--pf-ball); } input:focus-visible + .pf-color-opt { outline: 2px solid var(--pf-ball); }`}</style>
      </fieldset>
      <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>{t('language')}
        <select className="pf-field" name="locale" defaultValue={locale}>{locales.map((l) => <option key={l} value={l}>{localeNames[l]}</option>)}</select></label>
      <button className="pf-btn pf-btn-primary" disabled={pending} type="submit">{t('save')}</button>
      {state?.ok ? <p role="status" style={{ color: 'var(--pf-win)' }}>{t('saved')}</p> : null}
      <FormError error={state && !state.ok ? state.error : null} />
    </form>
  );
}

export function DeleteAccountForm() {
  const t = useTranslations('settings');
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(deleteAccount, null);
  return (
    <form action={action} style={{ display: 'grid', gap: 12 }} onSubmit={(e) => { if (!window.confirm(t('deleteConfirm'))) e.preventDefault(); }}>
      <p style={{ color: 'var(--pf-text-2)' }}>{t('deleteBody')}</p>
      <label style={{ display: 'flex', gap: 10, minHeight: 44, alignItems: 'center' }}><input type="checkbox" name="confirm" required style={{ width: 22, height: 22 }} />{t('deleteCheck')}</label>
      <button className="pf-btn" type="submit" disabled={pending} style={{ background: 'var(--pf-red)', color: '#fff' }}>{t('deleteBtn')}</button>
      <FormError error={state && !state.ok ? state.error : null} />
    </form>
  );
}
