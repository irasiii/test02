import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { Pill, LoadingState, ErrorState, EmptyState } from '@/components/ui';
import { api, unwrapList, ApiError } from '@/lib/api';

const statusTone = (s: string) =>
  s === 'ONLINE' ? 'green' as const :
  s === 'ON_TRIP' || s === 'ON_DELIVERY' ? 'blue' as const :
  'muted' as const;

export default function DriversPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true); setError(null);
    try {
      const res: any = await api.listDrivers();
      setRows(unwrapList(res));
    } catch (e) { setError((e as ApiError).message); }
    finally { setLoading(false); }
  }

  async function toggleApproval(d: any, isApproved: boolean) {
    // There is no direct admin endpoint on the backend yet — this is a placeholder.
    const verb = isApproved ? 'approve' : 'reject';
    if (!confirm(`Will ${verb} driver ${d.user?.firstName ?? d.id}. This is a UI placeholder; backend endpoint TBD.`)) return;
    alert('Action queued — add PATCH /drivers/:id endpoint to backend to make this work.');
  }

  const pending = rows.filter((d) => !d.isApproved && d.drivers && true);
  // Guard if API returns Doctor rows without "isApproved"
  const pendingSafe = rows.filter((d) => d.isApproved === false);

  return (
    <>
      <PageHeader title="Drivers" subtitle={`${rows.length} total drivers`} />
      {loading ? <LoadingState /> : error ? <ErrorState message={error} /> :
        <>
          {pendingSafe.length > 0 && (
            <div className="card mt-4" style={{ marginTop: 0, marginBottom: 16, background: '#fef3c7' }}>
              <div className="bold text-sm">⚠ Pending approval ({pendingSafe.length})</div>
              <p className="text-muted text-sm">
                The following drivers have registered but not yet been approved. Until approved they
                cannot go online.
              </p>
              <ul className="text-sm" style={{ paddingLeft: 16 }}>
                {pendingSafe.map((d) => (
                  <li key={d.id}>
                    {d.user?.firstName} {d.user?.lastName} · {d.user?.email}
                    <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => toggleApproval(d, true)}>Approve</button>
                    <button className="btn btn-sm" style={{ marginLeft: 4 }} onClick={() => toggleApproval(d, false)}>Reject</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {rows.length === 0 ? <EmptyState label="No drivers yet" /> :
          <table className="data">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Status</th>
                <th>Type</th>
                <th>Rating</th>
                <th>Trips</th>
                <th>Deliveries</th>
                <th>Approved</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td>{d.user?.firstName} {d.user?.lastName}<br/>
                    <span className="text-xs text-muted">{d.user?.email}</span>
                  </td>
                  <td><Pill value={d.status} tone={statusTone(d.status)} /></td>
                  <td><Pill value={d.type} tone="muted" /></td>
                  <td>{Number(d.rating ?? 0).toFixed(2)} ★</td>
                  <td>{d.totalTrips ?? 0}</td>
                  <td>{d.totalDeliveries ?? 0}</td>
                  <td>{d.isApproved ? <Pill value="Approved" tone="green" /> : <Pill value="Pending" tone="amber" />}</td>
                  <td>{d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>}
        </>
      }
    </>
  );
}
