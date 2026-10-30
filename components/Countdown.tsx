'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

export function Countdown({ to }: { to: string }) {
  const t = useTranslations('pending');
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la hora solo existe en el cliente (evita desajuste de hidratación)
    setNow(Date.now());
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);
  if (now === null) return <span>&nbsp;</span>;
  const ms = new Date(to).getTime() - now;
  if (ms <= 0) return <span>{t('expiredNow')}</span>;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return <span className="pf-mono" style={{ color: h < 6 ? 'var(--pf-red-text)' : 'var(--pf-text-2)' }}>{t('timeLeft', { h, m })}</span>;
}
