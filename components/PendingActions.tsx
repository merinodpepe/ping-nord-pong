'use client';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { confirmMatch, rejectMatch } from '@/app/actions';
import { Link } from '@/i18n/navigation';
import { FormError } from './FormMessage';

export function ConfirmButtons({ id, counterAlias }: { id: string; counterAlias: string }) {
  const t = useTranslations('pending');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejected, setRejected] = useState<null | 'wrong_result' | 'other'>(null);
  if (rejected === 'wrong_result') {
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <p style={{ color: 'var(--pf-text-2)' }}>{t('rejectedCounter')}</p>
        <Link className="pf-btn pf-btn-primary pf-btn-sm" href={`/apuntar?counter=${id}&rival=${encodeURIComponent(counterAlias)}`}>{t('counter')}</Link>
      </div>
    );
  }
  if (rejected) return <p style={{ color: 'var(--pf-muted)' }}>{t('rejectedDone')}</p>;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {rejecting ? (
        <fieldset style={{ border: 0, padding: 0, display: 'grid', gap: 8 }}>
          <legend style={{ fontWeight: 700, marginBottom: 6 }}>{t('rejectWhy')}</legend>
          {(['wrong_result', 'not_played', 'other'] as const).map((r) => (
            <button key={r} type="button" className="pf-btn pf-btn-secondary pf-btn-sm" disabled={pending}
              onClick={() => start(async () => { const res = await rejectMatch(id, r); if (res.ok) setRejected(r === 'wrong_result' ? 'wrong_result' : 'other'); else setError(res.error); })}>
              {t(`reason_${r}`)}
            </button>
          ))}
          <button type="button" className="pf-btn pf-btn-sm" style={{ color: 'var(--pf-muted)' }} onClick={() => setRejecting(false)}>{t('back')}</button>
        </fieldset>
      ) : (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="pf-btn pf-btn-primary pf-btn-sm" disabled={pending}
            onClick={() => start(async () => { const res = await confirmMatch(id); if (!res.ok) setError(res.error); })}>
            {t('confirm')}
          </button>
          <button type="button" className="pf-btn pf-btn-secondary pf-btn-sm" disabled={pending} onClick={() => setRejecting(true)}>{t('reject')}</button>
        </div>
      )}
      <FormError error={error} />
    </div>
  );
}
