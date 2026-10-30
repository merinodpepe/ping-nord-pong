'use client';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { blockUser, cancelChallenge, respondChallenge } from '@/app/actions';
import { FormError } from './FormMessage';

export function ChallengeActions({ id, canRespond, canCancel, otherId }: { id: string; canRespond: boolean; canCancel: boolean; otherId: string }) {
  const t = useTranslations('challenges');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); if (!r.ok) setError(r.error ?? 'generic'); });
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      {canRespond ? (
        <>
          <button className="pf-btn pf-btn-primary pf-btn-sm" disabled={pending} onClick={() => run(() => respondChallenge(id, true))}>{t('accept')}</button>
          <button className="pf-btn pf-btn-secondary pf-btn-sm" disabled={pending} onClick={() => run(() => respondChallenge(id, false))}>{t('decline')}</button>
        </>
      ) : null}
      {canCancel ? <button className="pf-btn pf-btn-secondary pf-btn-sm" disabled={pending} onClick={() => run(() => cancelChallenge(id))}>{t('cancel')}</button> : null}
      <button className="pf-btn pf-btn-sm" style={{ color: 'var(--pf-muted)' }} disabled={pending}
        onClick={() => { if (window.confirm(t('blockConfirm'))) run(() => blockUser(otherId)); }}>{t('block')}</button>
      <FormError error={error} />
    </div>
  );
}
