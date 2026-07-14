import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { Pill, LoadingState, ErrorState, EmptyState, orderStatusTone } from '@/components/ui';
import { api, unwrapList, ApiError } from '@/lib/api';

export default function OrdersPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true); setError(null);
    try {
      const res: any = await api.listOrders();
      setRows(unwrapList(res));
    } catch (e) { setError((e as ApiError).message); }
    finally { setLoading(false); }
  }

  const filtered = rows.filter((r) =>
    !q || (r.id + (r.customer?.email ?? '') + (r.restaurant?.name ?? '') + r.status).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <PageHeader title="Orders" subtitle={`${rows.length} food orders`} actions={
        <input className="input" style={{ width: 260 }} placeholder="Search by id, customer, status…" value={q} onChange={(e) => setQ(e.target.value)} />
      } />
      {loading ? <LoadingState /> : error ? <ErrorState message={error} /> :
        filtered.length === 0 ? <EmptyState label="No orders yet" /> :
        <table className="data">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Restaurant</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Total</th>
              <th>Address</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id}>
                <td>{o.customer?.email ?? o.customerId}</td>
                <td>{o.restaurant?.name ?? o.restaurantId}</td>
                <td><Pill value={o.status} tone={orderStatusTone(o.status)} /></td>
                <td><Pill value={o.paymentMethod} tone="blue" /></td>
                <td>${Number(o.total ?? 0).toFixed(2)}</td>
                <td className="text-xs text-muted">{o.deliveryAddress}</td>
                <td>{new Date(o.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    </>
  );
}
