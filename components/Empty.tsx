import type { ReactNode } from 'react';

/** Estado vacío con personalidad (plan 3.8): nunca cifras inventadas. */
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="pf-card" style={{ padding: '40px 24px', textAlign: 'center', borderStyle: 'dashed' }}>
      <p className="pf-display" style={{ fontSize: 24, marginBottom: 8 }}>{title}</p>
      {children ? <div style={{ color: 'var(--pf-muted)' }}>{children}</div> : null}
    </div>
  );
}
