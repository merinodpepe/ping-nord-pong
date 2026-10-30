/** Ping-Nord-Pong con los guiones en naranja pelota. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`pf-display ${className}`} style={{ letterSpacing: '-.5px' }}>
      Ping<span style={{ color: 'var(--pf-ball)' }}>-</span>Nord<span style={{ color: 'var(--pf-ball)' }}>-</span>Pong
    </span>
  );
}
