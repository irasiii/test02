import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { Pill, LoadingState, ErrorState, EmptyState } from '@/components/ui';
import { api, unwrapList, ApiError } from '@/lib/api';

const statusTone = (s: string) =>
  s === 'OPEN' ? 'green' as const :
  s === 'BUSY' ? 'amber' as const :
  'red' as const;

export default function RestaurantsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true); setError(null);
    try {
      const res: any = await api.listRestaurants();
      setRows(unwrapList(res));
    } catch (e) { setError((e as ApiError).message); }
    finally { setLoading(false); }
  }

  async function setStatus(r: any, status: 'OPEN' | 'CLOSED' | 'BUSY') {
    try {
      await api.updateRestaurant(r.id, { status });
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x)));
    } catch (e) { alert((e as ApiError).message); }
  }

  async function remove(r: any) {
    if (!confirm(`Delete ${r.name}? This is reversible.`)) return;
    try {
      await api.deleteRestaurant(r.id);
      setRows((prev) => prev.filter((x) => x.id !== r.id));
    } catch (e) { alert((e as ApiError).message); }
  }

  const filtered = rows.filter((r) =>
    !q || (r.name + (r.cuisineTypes ?? []).join(' ')).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <PageHeader title="Restaurants" subtitle={`${rows.length} partners`} actions={
        <input className="input" style={{ width: 260 }} placeholder="Search by name or cuisine…" value={q} onChange={(e) => setQ(e.target.value)} />
      } />
      {loading ? <LoadingState /> : error ? <ErrorState message={error} /> :
        filtered.length === 0 ? <EmptyState label="No restaurants yet" /> :
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Cuisines</th>
              <th>Rating</th>
              <th>Status</th>
              <th>Delivery fee</th>
              <th>Min order</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.name}<br/>
                  <span className="text-xs text-muted">{r.email} · {r.phone}</span>
                </td>
                <td>{(r.cuisineTypes ?? []).map((c: string) => <Pill key={c} value={c} tone="muted" />)}</td>
                <td>{Number(r.rating ?? 0).toFixed(2)} ★ ({r.ratingCount ?? 0})</td>
                <td><Pill value={r.status} tone={statusTone(r.status)} /></td>
                <td>${Number(r.deliveryFee ?? 0).toFixed(2)}</td>
                <td>${Number(r.minimumOrder ?? 0).toFixed(2)}</td>
                <td className="flex gap-2">
                  <button className="btn btn-sm" onClick={() => setStatus(r, 'OPEN')}>Open</button>
                  <button className="btn btn-sm" onClick={() => setStatus(r, 'BUSY')}>Busy</button>
                  <button className="btn btn-sm" onClick={() => setStatus(r, 'CLOSED')}>Close</button>
                  <button className="btn btn-sm btn-danger" onClick={() => remove(r)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    </>
  );
}
