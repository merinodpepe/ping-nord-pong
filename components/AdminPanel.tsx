'use client';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { adminForceAlias, adminResolveReport, adminReviewFlag, adminSetStatus, adminVoidMatch } from '@/app/actions';
import { FormError } from './FormMessage';

function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => { setOk(false); const r = await fn(); if (r.ok) { setOk(true); setError(null); } else setError(r.error ?? 'generic'); });
  return { pending, error, ok, run };
}

export function ReportActions({ id }: { id: string }) {
  const t = useTranslations('admin');
  const { pending, error, run } = useRun();
  const [note, setNote] = useState('');
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <label><span className="sr-only-focusable">{t('reason')}</span><input className="pf-field" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('reason')} maxLength={300} /></label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="pf-btn pf-btn-primary pf-btn-sm" disabled={pending || !note} onClick={() => run(() => adminResolveReport(id, 'resolved', note))}>{t('resolve')}</button>
        <button className="pf-btn pf-btn-secondary pf-btn-sm" disabled={pending || !note} onClick={() => run(() => adminResolveReport(id, 'dismissed', note))}>{t('dismiss')}</button>
      </div>
      <FormError error={error} />
    </div>
  );
}

export function FlagActions({ id }: { id: number }) {
  const t = useTranslations('admin');
  const { pending, error, run } = useRun();
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button className="pf-btn pf-btn-secondary pf-btn-sm" disabled={pending} onClick={() => run(() => adminReviewFlag(id, 'reviewed'))}>{t('reviewed')}</button>
      <button className="pf-btn pf-btn-secondary pf-btn-sm" disabled={pending} onClick={() => run(() => adminReviewFlag(id, 'dismissed'))}>{t('dismiss')}</button>
      <FormError error={error} />
    </div>
  );
}

export function ToolsPanel() {
  const t = useTranslations('admin');
  const v = useRun(); const s = useRun(); const a = useRun();
  const [matchId, setMatchId] = useState(''); const [why, setWhy] = useState('');
  const [pid, setPid] = useState(''); const [status, setStatus] = useState<'active' | 'limited' | 'banned'>('limited'); const [days, setDays] = useState(7);
  const [newAlias, setNewAlias] = useState('');
  const box = { display: 'grid', gap: 10, padding: 18 } as const;
  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
      <label className="pf-card" style={{ ...box }}>
        <strong>{t('reasonAll')}</strong>
        <input className="pf-field" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={200} />
      </label>
      <form className="pf-card" style={box} onSubmit={(e) => { e.preventDefault(); v.run(() => adminVoidMatch(matchId, why)); }}>
        <strong>{t('voidMatch')}</strong>
        <input className="pf-field pf-mono" placeholder="match id" value={matchId} onChange={(e) => setMatchId(e.target.value)} required />
        <button className="pf-btn pf-btn-primary pf-btn-sm" disabled={v.pending || !why}>{t('voidBtn')}</button>
        {v.ok ? <span role="status" style={{ color: 'var(--pf-win)' }}>{t('done')}</span> : null}<FormError error={v.error} />
      </form>
      <form className="pf-card" style={box} onSubmit={(e) => { e.preventDefault(); s.run(() => adminSetStatus(pid, status, days, why)); }}>
        <strong>{t('account')}</strong>
        <input className="pf-field pf-mono" placeholder="profile id" value={pid} onChange={(e) => setPid(e.target.value)} required />
        <select className="pf-field" value={status} onChange={(e) => setStatus(e.target.value as never)}>
          <option value="limited">{t('limit')}</option><option value="banned">{t('ban')}</option><option value="active">{t('unban')}</option>
        </select>
        {status === 'limited' ? <input className="pf-field" type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label={t('days')} /> : null}
        <button className="pf-btn pf-btn-primary pf-btn-sm" disabled={s.pending || !why}>{t('apply')}</button>
        {s.ok ? <span role="status" style={{ color: 'var(--pf-win)' }}>{t('done')}</span> : null}<FormError error={s.error} />
      </form>
      <form className="pf-card" style={box} onSubmit={(e) => { e.preventDefault(); a.run(() => adminForceAlias(pid, newAlias, why)); }}>
        <strong>{t('forceAlias')}</strong>
        <input className="pf-field pf-mono" placeholder="profile id" value={pid} onChange={(e) => setPid(e.target.value)} required />
        <input className="pf-field" placeholder={t('newAlias')} value={newAlias} onChange={(e) => setNewAlias(e.target.value)} required maxLength={20} />
        <button className="pf-btn pf-btn-primary pf-btn-sm" disabled={a.pending || !why}>{t('apply')}</button>
        {a.ok ? <span role="status" style={{ color: 'var(--pf-win)' }}>{t('done')}</span> : null}<FormError error={a.error} />
      </form>
    </div>
  );
}
