import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { Pill, LoadingState, ErrorState, EmptyState, roleTone } from '@/components/ui';
import { api, unwrapList, ApiError } from '@/lib/api';

export default function UsersPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true); setError(null);
    try {
      const res: any = await api.listUsers();
      setRows(unwrapList(res));
    } catch (e) { setError((e as ApiError).message); }
    finally { setLoading(false); }
  }

  const filtered = rows.filter((r) =>
    !q || (r.email + r.phone + r.firstName + r.lastName).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <PageHeader title="Users" subtitle={`${rows.length} registered`} actions={
        <input className="input" style={{ width: 260 }} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      } />
      {loading ? <LoadingState /> : error ? <ErrorState message={error} /> :
        filtered.length === 0 ? <EmptyState label="No users yet" /> :
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Status</th>
              <th>Wallet</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id}>
                <td>{u.firstName} {u.lastName}</td>
                <td>{u.email}</td>
                <td>{u.phone}</td>
                <td><Pill value={u.role} tone={roleTone(u.role)} /></td>
                <td>{u.isActive ? <Pill value="Active" tone="green" /> : <Pill value="Disabled" tone="red" />}</td>
                <td>${Number(u.walletBalance ?? 0).toFixed(2)}</td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    </>
  );
}
