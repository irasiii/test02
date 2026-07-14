import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { Pill, LoadingState, ErrorState, EmptyState } from '@/components/ui';
import { api, unwrapList, ApiError } from '@/lib/api';

const statusTone = (s: string) =>
  s === 'SUCCEEDED' ? 'green' as const :
  s === 'REFUNDED' || s === 'PARTIALLY_REFUNDED' ? 'amber' as const :
  s === 'FAILED' || s === 'CANCELLED' ? 'red' as const :
  'muted' as const;

export default function PaymentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true); setError(null);
    try {
      const res: any = await api.listPayments();
      setRows(unwrapList(res));
    } catch (e) {
      const err = e as ApiError;
      // Backend does not yet expose a list endpoint; surface a helpful note.
      setError(err.status === 404
        ? 'Payment list endpoint is not available on the backend yet (GET /payments).'
        : err.message);
    }
    finally { setLoading(false); }
  }

  async function refund(p: any) {
    if (!confirm(`Refund $${Number(p.amount).toFixed(2)} (${p.currency})?`)) return;
    setBusy(p.id);
    try {
      await api.refund(p.id);
      setRows((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: 'REFUNDED' } : x)));
    } catch (e) { alert((e as ApiError).message); }
    finally { setBusy(null); }
  }

  return (
    <>
      <PageHeader title="Payments" subtitle={`${rows.length} records`} actions={
        <button className="btn btn-sm" onClick={load}>Refresh</button>
      } />
      {loading ? <LoadingState /> : error ? <ErrorState message={error} /> :
        rows.length === 0 ? <EmptyState label="No payments yet" /> :
        <table className="data">
          <thead>
            <tr>
              <th>User</th>
              <th>Purpose</th>
              <th>Reference</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.user?.email ?? p.userId}</td>
                <td><Pill value={p.purpose} tone="blue" /></td>
                <td className="text-xs text-muted">{p.referenceId ?? '—'}</td>
                <td>${Number(p.amount).toFixed(2)} {p.currency}</td>
                <td><Pill value={p.status} tone={statusTone(p.status)} /></td>
                <td>
                  {p.status === 'SUCCEEDED' && (
                    <button className="btn btn-sm btn-danger" disabled={busy === p.id} onClick={() => refund(p)}>
                      {busy === p.id ? '…' : 'Refund'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    </>
  );
}
