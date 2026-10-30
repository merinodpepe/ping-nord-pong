'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { sendMessage } from '@/app/actions';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { FormError } from './FormMessage';

export type Msg = { id: number; sender_id: string | null; body: string; flagged: boolean; created_at: string };

/** Chat del reto: texto plano, sin enlaces clicables, con Realtime (RLS: solo los dos participantes). */
export function ChatBox({ challengeId, me, names, initial, writable }: { challengeId: string; me: string; names: Record<string, string>; initial: Msg[]; writable: boolean }) {
  const t = useTranslations('challenges');
  const f = useFormatter();
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [shown, setShown] = useState<Set<number>>(new Set());
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    const ch = sb
      .channel(`chat:${challengeId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `challenge_id=eq.${challengeId}` }, (p: { new: unknown }) => {
        const m = p.new as Msg;
        setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      })
      .subscribe();
    return () => { void sb.removeChannel(ch); };
  }, [challengeId]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs.length]);

  return (
    <div className="pf-card" style={{ display: 'grid', gridTemplateRows: '1fr auto', minHeight: 360 }}>
      <ul aria-live="polite" aria-label={t('chat')} style={{ padding: 16, display: 'grid', gap: 8, alignContent: 'start', maxHeight: 460, overflowY: 'auto' }}>
        {msgs.length === 0 ? <li style={{ color: 'var(--pf-muted)' }}>{t('chatEmpty')}</li> : null}
        {msgs.map((m) => {
          const mine = m.sender_id === me;
          const hidden = m.flagged && !shown.has(m.id);
          return (
            <li key={m.id} style={{ justifySelf: mine ? 'end' : 'start', maxWidth: '85%' }}>
              <div style={{ fontSize: 12, color: 'var(--pf-faint)', marginBottom: 2 }}>
                {m.sender_id ? names[m.sender_id] ?? '?' : t('deleted')} · {f.dateTime(new Date(m.created_at), { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style={{ background: mine ? 'var(--pf-table)' : 'var(--pf-surface-2)', padding: '8px 12px', borderRadius: 14, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                {hidden ? (
                  <button type="button" onClick={() => setShown((s) => new Set(s).add(m.id))} style={{ background: 'none', border: 0, color: 'var(--pf-muted)', textDecoration: 'underline', minHeight: 24 }}>
                    {t('flagged')}
                  </button>
                ) : (
                  m.body
                )}
              </div>
            </li>
          );
        })}
        <div ref={end} />
      </ul>
      {writable ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const body = text.trim();
            if (!body) return;
            start(async () => {
              const res = await sendMessage(challengeId, body);
              if (res.ok) { setText(''); setError(null); } else setError(res.error);
            });
          }}
          style={{ borderTop: '1px solid var(--pf-line)', padding: 12, display: 'grid', gap: 6 }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ flex: 1 }}>
              <span className="sr-only-focusable">{t('message')}</span>
              <input className="pf-field" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder={t('messagePlaceholder')} autoComplete="off" />
            </label>
            <button className="pf-btn pf-btn-primary pf-btn-sm" type="submit" disabled={pending || !text.trim()}>{t('send')}</button>
          </div>
          <span style={{ color: 'var(--pf-faint)', fontSize: 12 }}>{t('chatRules', { n: text.length })}</span>
          <FormError error={error} />
        </form>
      ) : (
        <p style={{ borderTop: '1px solid var(--pf-line)', padding: 12, color: 'var(--pf-muted)' }}>{t('chatClosed')}</p>
      )}
    </div>
  );
}
