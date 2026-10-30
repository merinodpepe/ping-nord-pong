import { useTranslations } from 'next-intl';

/** Loader: pelota botando (design/svg/pelota-loader.svg). */
export function Loader({ size = 80 }: { size?: number }) {
  const t = useTranslations('common');
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width={size} height={size} role="img" aria-label={t('loading')}>
      <style>{`
        @keyframes pfLb { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-34px) } }
        @keyframes pfLs { 0%, 100% { transform: scaleX(1); opacity: .45 } 50% { transform: scaleX(.55); opacity: .2 } }
        .pf-lball { animation: pfLb .7s cubic-bezier(.3,0,.7,1) infinite }
        .pf-lshadow { transform-origin: 40px 70px; animation: pfLs .7s cubic-bezier(.3,0,.7,1) infinite }
        @media (prefers-reduced-motion: reduce) { .pf-lball, .pf-lshadow { animation: none } }
      `}</style>
      <line x1="12" y1="66" x2="68" y2="66" stroke="#E8EEF7" strokeWidth="3" strokeLinecap="round" opacity=".6" />
      <ellipse className="pf-lshadow" cx="40" cy="70" rx="10" ry="3" fill="#000" />
      <g className="pf-lball"><circle cx="40" cy="52" r="10" fill="#FF7A1A" /><circle cx="36.5" cy="48.5" r="3" fill="#FFD2A8" /></g>
    </svg>
  );
}
