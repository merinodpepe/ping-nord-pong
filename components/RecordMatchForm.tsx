'use client';
import { useMemo, useState, useTransition } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { createMatch } from '@/app/actions';
import { weightM } from '@/lib/elo';
import { BEST_OF, POINTS_TARGETS, validateSets, type SetScore } from '@/lib/match-validation';
import { CopyLink } from './CopyLink';
import { FormError } from './FormMessage';

type Player = { id: string; alias: string };
type Props = { me: Player; players: Player[]; initialRival?: string; challengeId?: string; counterOf?: string };

export function RecordMatchForm({ me, players, initialRival, challengeId, counterOf }: Props) {
  const t = useTranslations('record');
  const tv = useTranslations('record.validation');
  const f = useFormatter();
  const locale = useLocale();
  const [mode, setMode] = useState<'1v1' | '2v2'>('1v1');
  const [points, setPoints] = useState<(typeof POINTS_TARGETS)[number]>(11);
  const [bestOf, setBestOf] = useState<(typeof BEST_OF)[number]>(1);
  const [winByTwo, setWinByTwo] = useState(true);
  const [rivals, setRivals] = useState<string[]>([initialRival ?? '', '']);
  const [partner, setPartner] = useState('');
  const [sets, setSets] = useState<string[][]>(Array.from({ length: 7 }, () => ['', '']));
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const find = (alias: string) => players.find((p) => p.alias.toLowerCase() === alias.trim().toLowerCase());
  const filled: SetScore[] = useMemo(
    () => sets.slice(0, bestOf).filter((s) => s[0] !== '' || s[1] !== '').map((s) => [Number(s[0]), Number(s[1])] as const),
    [sets, bestOf],
  );
  const result = validateSets(points, bestOf, winByTwo, filled);
  const m = weightM({ pointsTarget: points, bestOf });
  const need = Math.ceil(bestOf / 2);
  const size = mode === '1v1' ? 1 : 2;
  const rivalPlayers = rivals.slice(0, size).map(find);
  const partnerP = find(partner);
  const playersOk = rivalPlayers.every(Boolean) && (mode === '1v1' || partnerP) && new Set([me.id, partnerP?.id, ...rivalPlayers.map((r) => r?.id)].filter(Boolean)).size === size * 2;
  const rivalLabel = rivalPlayers.filter(Boolean).map((r) => r!.alias).join(' + ') || t('rival');

  function submit() {
    setError(null);
    if (!playersOk || !result.ok) return;
    start(async () => {
      const res = await createMatch({
        mode, pointsTarget: points, bestOf, winByTwo,
        teamA: mode === '1v1' ? [me.id] : [me.id, partnerP!.id], teamB: rivalPlayers.map((r) => r!.id),
        sets: filled, counterOf, challengeId,
      });
      if (res.ok) setDone(res.data!.id);
      else setError(res.error);
    });
  }

  if (done) {
    const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/${locale}/pendientes?m=${done}`;
    return (
      <div className="pf-card" role="status" style={{ padding: 24, display: 'grid', gap: 14 }}>
        <p className="pf-display" style={{ fontSize: 26 }}>{t('sentTitle', { alias: rivalLabel })}</p>
        <p style={{ color: 'var(--pf-text-2)' }}>{t('sentBody')}</p>
        <CopyLink value={link} />
      </div>
    );
  }

  const setError_ = !result.ok && filled.length > 0 ? tv(result.error) : null;
  const pillStyle = { minHeight: 48 } as const;
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} style={{ display: 'grid', gap: 24 }}>
      <fieldset style={{ border: 0, padding: 0 }}>
        <legend className="pf-label" style={{ marginBottom: 8 }}>{t('mode')}</legend>
        <div className="pf-seg" role="group">
          {(['1v1', '2v2'] as const).map((x) => (
            <button type="button" key={x} aria-pressed={mode === x} onClick={() => setMode(x)}>{x}</button>
          ))}
        </div>
      </fieldset>

      <div style={{ display: 'grid', gap: 12 }}>
        <span className="pf-label">{t('rival')}</span>
        <datalist id="players">{players.filter((p) => p.id !== me.id).map((p) => <option key={p.id} value={p.alias} />)}</datalist>
        {mode === '2v2' ? (
          <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
            {t('partner')}
            <input className="pf-field" list="players" value={partner} onChange={(e) => setPartner(e.target.value)} autoComplete="off" autoCapitalize="none" required />
          </label>
        ) : null}
        {Array.from({ length: size }, (_, i) => (
          <label key={i} style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
            {size === 1 ? t('rivalAlias') : t('rivalN', { n: i + 1 })}
            <input className="pf-field" list="players" value={rivals[i] ?? ''} onChange={(e) => setRivals((r) => r.map((x, j) => (j === i ? e.target.value : x)))} autoComplete="off" autoCapitalize="none" required />
          </label>
        ))}
        {!playersOk && (rivals[0] || partner) ? <p style={{ color: 'var(--pf-muted)', fontSize: 13 }}>{t('playerHint')}</p> : null}
      </div>

      <fieldset style={{ border: 0, padding: 0 }}>
        <legend className="pf-label" style={{ marginBottom: 8 }}>{t('pointsPerSet')}</legend>
        <div className="pf-pillgrid">
          {POINTS_TARGETS.map((p) => <button type="button" key={p} aria-pressed={points === p} onClick={() => setPoints(p)} style={pillStyle}>{t('toN', { n: p })}</button>)}
        </div>
      </fieldset>

      <fieldset style={{ border: 0, padding: 0 }}>
        <legend className="pf-label" style={{ marginBottom: 8 }}>{t('sets')}</legend>
        <div className="pf-pillgrid">
          {BEST_OF.map((b) => <button type="button" key={b} aria-pressed={bestOf === b} onClick={() => setBestOf(b)} style={pillStyle}>{b === 1 ? t('oneSet') : t('bestOf', { n: b })}</button>)}
        </div>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, marginTop: 8 }}>
          <input type="checkbox" checked={winByTwo} onChange={(e) => setWinByTwo(e.target.checked)} style={{ width: 22, height: 22 }} />
          {t('winByTwo')}
        </label>
      </fieldset>

      <fieldset style={{ border: 0, padding: 0, display: 'grid', gap: 10 }}>
        <legend className="pf-label" style={{ marginBottom: 8 }}>{t('score')}</legend>
        {Array.from({ length: bestOf }, (_, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 24px 1fr', alignItems: 'center', gap: 8 }}>
            <span className="pf-mono" style={{ color: 'var(--pf-faint)' }}>{t('setN', { n: i + 1 })}</span>
            <input className="pf-field pf-mono" inputMode="numeric" pattern="[0-9]*" maxLength={2} aria-label={t('scoreOf', { who: me.alias, n: i + 1 })}
              value={sets[i]![0]} onChange={(e) => setSets((s) => s.map((r, j) => (j === i ? [e.target.value.replace(/\D/g, ''), r[1]!] : r)))}
              style={{ textAlign: 'center', fontWeight: 700, color: 'var(--pf-red-text)', fontSize: 20 }} />
            <span style={{ textAlign: 'center', color: '#4A5B78' }}>-</span>
            <input className="pf-field pf-mono" inputMode="numeric" pattern="[0-9]*" maxLength={2} aria-label={t('scoreOf', { who: rivalLabel, n: i + 1 })}
              value={sets[i]![1]} onChange={(e) => setSets((s) => s.map((r, j) => (j === i ? [r[0]!, e.target.value.replace(/\D/g, '')] : r)))}
              style={{ textAlign: 'center', fontWeight: 700, color: 'var(--pf-blue-text)', fontSize: 20 }} />
          </div>
        ))}
        <p style={{ color: 'var(--pf-muted)', fontSize: 13 }}>{t('setsHint', { need })}</p>
        <div aria-live="polite" style={{ minHeight: 24 }}>
          {setError_ ? <p style={{ color: 'var(--pf-red-text)', fontWeight: 600 }}>{setError_}</p> : null}
          {result.ok ? <p style={{ color: 'var(--pf-win)', fontWeight: 600 }}>{t('winner', { who: result.winner === 'A' ? me.alias : rivalLabel, a: result.setsA, b: result.setsB })}</p> : null}
        </div>
      </fieldset>

      <div className="pf-card" style={{ padding: '12px 16px' }}>
        <span className="pf-mono">{t('weight', { m: f.number(m, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}</span>
        <span style={{ color: 'var(--pf-muted)', marginLeft: 8, fontSize: 13 }}>{t('weightHelp')}</span>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <button className="pf-btn pf-btn-primary" type="submit" disabled={pending || !result.ok || !playersOk}>{t('submit', { alias: rivalLabel })}</button>
        <p style={{ color: 'var(--pf-muted)', fontSize: 13, textAlign: 'center' }}>{t('expiry')}</p>
        <FormError error={error} />
      </div>
    </form>
  );
}
