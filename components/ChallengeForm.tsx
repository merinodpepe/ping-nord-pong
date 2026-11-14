'use client';
import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createChallenge } from '@/app/actions';
import type { ActionResult } from '@/lib/errors';
import type { PlayerOption } from '@/lib/alias';
import { FormError } from './FormMessage';
import { PlayerPicker } from './PlayerPicker';

export function ChallengeForm({ initial }: { initial: PlayerOption | null }) {
  const [rival, setRival] = useState<PlayerOption | null>(initial);
  const t = useTranslations('challenges');
  const [state, action, pending] = useActionState<ActionResult<{ id: string }> | null, FormData>(createChallenge, null);
  return (
    <form action={action} style={{ display: 'grid', gap: 16 }}>
      <PlayerPicker label={t('rival')} name="to_id" value={rival} onChange={setRival} required />
      <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>{t('when')}
        <input className="pf-field" type="datetime-local" name="when" /></label>
      <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>{t('place')}
        <input className="pf-field" name="place" maxLength={80} placeholder={t('placeHint')} /></label>
      <fieldset style={{ border: 0, padding: 0 }}>
        <legend style={{ fontWeight: 600, marginBottom: 6 }}>{t('mode')}</legend>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={{ display: 'flex', gap: 8, minHeight: 44, alignItems: 'center' }}><input type="radio" name="mode" value="1v1" defaultChecked /> 1v1</label>
          <label style={{ display: 'flex', gap: 8, minHeight: 44, alignItems: 'center' }}><input type="radio" name="mode" value="2v2" /> 2v2</label>
        </div>
      </fieldset>
      <button className="pf-btn pf-btn-primary" type="submit" disabled={pending || !rival}>{t('create')}</button>
      <FormError error={state && !state.ok ? state.error : null} />
    </form>
  );
}
