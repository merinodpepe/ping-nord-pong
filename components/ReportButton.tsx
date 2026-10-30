'use client';
import { useActionState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { createReport } from '@/app/actions';
import type { ActionResult } from '@/lib/errors';
import { FormError } from './FormMessage';
import { Turnstile } from './Turnstile';

type Target = { targetProfile?: string; targetMatch?: string; targetMessage?: number };

export function ReportButton(t_: Target) {
  const t = useTranslations('report');
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createReport, null);
  return (
    <>
      <button type="button" className="pf-btn pf-btn-secondary pf-btn-sm" onClick={() => ref.current?.showModal()}>{t('open')}</button>
      <dialog ref={ref} aria-labelledby="report-title" style={{ background: 'var(--pf-surface)', color: 'var(--pf-text)', border: '1px solid var(--pf-line-strong)', borderRadius: 20, padding: 24, maxWidth: 440, width: 'calc(100% - 32px)', margin: 'auto' }}>
        {state?.ok ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <p id="report-title" className="pf-display" style={{ fontSize: 22 }}>{t('doneTitle')}</p>
            <p style={{ color: 'var(--pf-text-2)' }}>{t('doneBody')}</p>
            <button className="pf-btn pf-btn-secondary" onClick={() => ref.current?.close()}>{t('close')}</button>
          </div>
        ) : (
          <form action={action} style={{ display: 'grid', gap: 14 }}>
            <h2 id="report-title" className="pf-display" style={{ fontSize: 22 }}>{t('title')}</h2>
            {t_.targetProfile ? <input type="hidden" name="profile" value={t_.targetProfile} /> : null}
            {t_.targetMatch ? <input type="hidden" name="match" value={t_.targetMatch} /> : null}
            {t_.targetMessage ? <input type="hidden" name="message" value={t_.targetMessage} /> : null}
            <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
              {t('reason')}
              <select className="pf-field" name="reason" required defaultValue="">
                <option value="" disabled>{t('choose')}</option>
                {(['fake_result', 'harassment', 'spam', 'impersonation', 'offensive_alias', 'other'] as const).map((r) => <option key={r} value={r}>{t(`reason_${r}`)}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
              {t('details')}
              <textarea className="pf-field" name="details" maxLength={500} rows={3} />
            </label>
            <Turnstile action="report" />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="pf-btn pf-btn-primary pf-btn-sm" type="submit" disabled={pending}>{t('send')}</button>
              <button className="pf-btn pf-btn-secondary pf-btn-sm" type="button" onClick={() => ref.current?.close()}>{t('cancel')}</button>
            </div>
            <FormError error={state && !state.ok ? state.error : null} />
          </form>
        )}
      </dialog>
    </>
  );
}
