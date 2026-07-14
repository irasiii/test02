import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { Pill, LoadingState, ErrorState, EmptyState } from '@/components/ui';
import { api, unwrapList, ApiError } from '@/lib/api';

const TARGETS = ['TRIP', 'DRIVER', 'RESTAURANT', 'USER', 'ORDER'] as const;

export default function RatingsPage() {
  const [target, setTarget] = useState<typeof TARGETS[number]>('DRIVER');
  const [targetId, setTargetId] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!targetId.trim()) { setError('Enter a target id to view ratings.'); return; }
    setLoading(true); setError(null);
    try {
      const res: any = await api.listRatings(target, targetId.trim());
      setRows(unwrapList(res));
    } catch (e) { setError((e as ApiError).message); }
    finally { setLoading(false); }
  }

  return (
    <>
      <PageHeader title="Ratings & Reviews" subtitle={`${rows.length} ratings`} />
      <div className="flex gap-2" style={{ marginBottom: 16 }}>
        <select className="input" style={{ width: 160 }} value={target} onChange={(e) => setTarget(e.target.value as any)}>
          {TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className="input" style={{ flex: 1 }} placeholder="Target id (e.g. driver id)…" value={targetId} onChange={(e) => setTargetId(e.target.value)} />
        <button className="btn" onClick={load}>Load</button>
      </div>
      {loading ? <LoadingState /> : error ? <ErrorState message={error} /> :
        rows.length === 0 ? <EmptyState label="No ratings for this target" /> :
        <table className="data">
          <thead>
            <tr>
              <th>From</th>
              <th>Score</th>
              <th>Comment</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.author?.email ?? r.authorId ?? '—'}</td>
                <td><Pill value={`${Number(r.score).toFixed(1)} ★`} tone={Number(r.score) >= 4 ? 'green' : Number(r.score) >= 3 ? 'amber' : 'red'} /></td>
                <td className="text-xs">{r.comment || '—'}</td>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    </>
  );
}
