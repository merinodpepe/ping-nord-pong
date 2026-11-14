'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { searchPlayers } from '@/app/actions';
import type { PlayerOption } from '@/lib/alias';
import { Avatar } from './Avatar';

type Props = {
  label: string;
  value: PlayerOption | null;
  onChange: (p: PlayerOption | null) => void;
  /** Si se indica, se envía el id elegido en un campo oculto con este nombre. */
  name?: string;
  exclude?: string[];
  required?: boolean;
};

/** Combobox de jugadores: al escribir el alias sugiere coincidencias hacia abajo. */
export function PlayerPicker({ label, value, onChange, name, exclude = [], required }: Props) {
  const t = useTranslations('picker');
  const uid = useId();
  const listId = `${uid}-list`;
  const [text, setText] = useState(value ? value.alias : '');
  const [result, setResult] = useState<{ q: string; list: PlayerOption[] }>({ q: '', list: [] });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const seq = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const excludeKey = exclude.join(',');
  const q = text.trim();
  // Solo se muestran resultados que corresponden al texto actual
  const searched = !value && q !== '' && result.q === q;
  const options = searched ? result.list : [];

  useEffect(() => {
    if (value || !q) return;
    const n = ++seq.current;
    const id = setTimeout(async () => {
      const res = await searchPlayers(q, excludeKey ? excludeKey.split(',') : []);
      if (n !== seq.current) return;
      setResult({ q, list: res }); setActive(res.length ? 0 : -1); setOpen(true);
    }, 200);
    return () => clearTimeout(id);
  }, [q, value, excludeKey]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function pick(p: PlayerOption) {
    onChange(p); setText(p.alias); setOpen(false);
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && open && options[active]) { e.preventDefault(); pick(options[active]!); }
    else if (e.key === 'Escape') setOpen(false);
  }

  const showList = open && !value && q !== '';
  return (
    <div ref={box} style={{ position: 'relative', display: 'grid', gap: 6 }}>
      <label htmlFor={`${uid}-in`} style={{ fontWeight: 600 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          id={`${uid}-in`} className="pf-field" role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${uid}-o${active}` : undefined}
          value={value ? `${value.alias}#${value.tag}` : text}
          onChange={(e) => { if (value) onChange(null); setText(e.target.value); setOpen(true); }}
          onFocus={() => text.trim() && setOpen(true)} onKeyDown={onKey}
          placeholder={t('placeholder')} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={26} required={required && !value}
          style={{ width: '100%' }}
        />
        {value ? (
          <button type="button" onClick={() => { onChange(null); setText(''); }} aria-label={t('clear')}
            style={{ position: 'absolute', right: 4, top: 0, bottom: 0, minWidth: 44, color: 'var(--pf-muted)' }}>×</button>
        ) : null}
      </div>
      {name ? <input type="hidden" name={name} value={value?.id ?? ''} /> : null}
      {showList ? (
        <ul id={listId} role="listbox" aria-label={label} className="pf-card"
          style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4, padding: 4, maxHeight: 320, overflowY: 'auto', background: 'var(--pf-surface, var(--pf-bg))' }}>
          {options.map((o, i) => (
            <li key={o.id} id={`${uid}-o${i}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }} onMouseEnter={() => setActive(i)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '0 10px', borderRadius: 8, cursor: 'pointer', background: i === active ? 'rgba(255,122,26,.16)' : 'transparent' }}>
              <Avatar id={o.id} alias={o.alias} color={o.color} size={28} />
              <span style={{ fontWeight: 700 }}>{o.alias}</span>
              <span className="pf-mono" style={{ color: 'var(--pf-faint)' }}>#{o.tag}</span>
            </li>
          ))}
          {!options.length && searched ? <li role="presentation" style={{ padding: '12px 10px', color: 'var(--pf-muted)' }}>{t('noResults')}</li> : null}
        </ul>
      ) : null}
      <span className="sr-only-focusable" role="status" aria-live="polite">{showList && searched ? t('count', { n: options.length }) : ''}</span>
    </div>
  );
}
