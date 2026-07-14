import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { Pill, LoadingState, ErrorState, EmptyState, tripStatusTone } from '@/components/ui';
import { api, unwrapList, ApiError } from '@/lib/api';

export default function TripsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true); setError(null);
    try {
      const res: any = await api.listTrips();
      setRows(unwrapList(res));
    } catch (e) { setError((e as ApiError).message); }
    finally { setLoading(false); }
  }

  const filtered = rows.filter((r) =>
    !q || (r.id + (r.customer?.email ?? '') + (r.driver?.user?.email ?? '') + r.status).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <PageHeader title="Trips" subtitle={`${rows.length} rides/parcels`} actions={
        <input className="input" style={{ width: 260 }} placeholder="Search by id, customer, status…" value={q} onChange={(e) => setQ(e.target.value)} />
      } />
      {loading ? <LoadingState /> : error ? <ErrorState message={error} /> :
        filtered.length === 0 ? <EmptyState label="No trips yet" /> :
        <table className="data">
          <thead>
            <tr>
              <th>Type</th>
              <th>Customer</th>
              <th>Driver</th>
              <th>Status</th>
              <th>Fare</th>
              <th>Distance</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id}>
                <td><Pill value={t.type} tone="muted" /></td>
                <td>{t.customer?.email ?? t.customerId}</td>
                <td>{t.driver?.user?.email ?? t.driverId ?? '—'}</td>
                <td><Pill value={t.status} tone={tripStatusTone(t.status)} /></td>
                <td>${Number(t.finalFare ?? t.fareEstimate ?? 0).toFixed(2)}</td>
                <td>{Number(t.distanceKm ?? 0).toFixed(1)} km</td>
                <td>{new Date(t.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    </>
  );
}
