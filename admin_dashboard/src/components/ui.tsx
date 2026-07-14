import { ReactNode } from 'react';

export function StatCard({ label, value, delta, icon }: { label: string; value: string | number; delta?: string; icon?: ReactNode }) {
  return (
    <div className="stat-card">
      <div className="flex-between">
        <div className="label">{label}</div>
        {icon}
      </div>
      <div className="value">{value}</div>
      {delta && <div className="delta">{delta}</div>}
    </div>
  );
}

export function Pill({ value, tone = 'muted' }: { value: string; tone?: 'green' | 'red' | 'amber' | 'blue' | 'muted' }) {
  return <span className={`tag tag-${tone}`}>{value}</span>;
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--geny-muted)' }}>
      <div style={{ fontSize: 40, opacity: 0.3 }}>📭</div>
      <div style={{ marginTop: 8 }}>{label}</div>
    </div>
  );
}

export function LoadingState() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: 200, color: 'var(--geny-muted)' }}>
      <div>Loading…</div>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 24, background: '#fde2e2', color: '#ab1f1a', borderRadius: 8 }}>
      {message}
    </div>
  );
}

export const roleTone = (role: string) =>
  role === 'ADMIN' ? 'red' as const :
  role === 'DRIVER' ? 'amber' as const :
  role === 'RESTAURANT' ? 'blue' as const :
  'green' as const;

export const tripStatusTone = (s: string) =>
  /COMPLETED/i.test(s) ? 'green' as const :
  /CANCEL/i.test(s) ? 'red' as const :
  /STARTED/i.test(s) ? 'blue' as const :
  'amber' as const;

export const orderStatusTone = (s: string) =>
  /DELIVERED/i.test(s) ? 'green' as const :
  /CANCEL|REJECT/i.test(s) ? 'red' as const :
  /ON_THE_WAY|PICKED_UP/i.test(s) ? 'blue' as const :
  'amber' as const;
