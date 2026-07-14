import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { StatCard, LoadingState } from '@/components/ui';
import { api, unwrapList, ApiError } from '@/lib/api';

interface DashboardMetrics {
  totalUsers: number;
  totalDrivers: number;
  totalRestaurants: number;
  activeTrips: number;
  activeOrders: number;
  grossRevenue: number;
  ratingsAverage: number;
  rideCompletionRate: number;
}

function emptyMetrics(): DashboardMetrics {
  return {
    totalUsers: 0, totalDrivers: 0, totalRestaurants: 0,
    activeTrips: 0, activeOrders: 0, grossRevenue: 0,
    ratingsAverage: 0, rideCompletionRate: 0,
  };
}

export default function DashboardPage() {
  const [m, setM] = useState<DashboardMetrics>(emptyMetrics);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const errs: string[] = [];
      const metrics = emptyMetrics();
      try {
        const usersRes: any = await api.listUsers();
        const users = unwrapList(usersRes);
        metrics.totalUsers = users.length;
      } catch (e) { errs.push((e as ApiError).message); }

      try {
        const driversRes: any = await api.listDrivers();
        const drivers = unwrapList(driversRes);
        metrics.totalDrivers = drivers.length;
        metrics.activeTrips = drivers.filter((d: any) => d.status === 'ON_TRIP' || d.status === 'ON_DELIVERY').length;
      } catch (e) { errs.push((e as ApiError).message); }

      try {
        const restRes: any = await api.listRestaurants();
        const rest = unwrapList(restRes);
        metrics.totalRestaurants = rest.length;
      } catch (e) { errs.push((e as ApiError).message); }

      try {
        const ordersRes: any = await api.listOrders();
        const orders = unwrapList<any>(ordersRes);
        const activeStatuses = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP', 'ON_THE_WAY'];
        metrics.activeOrders = orders.filter((o: any) => activeStatuses.includes(o.status)).length;
        // We use total of orders as a proxy for gross revenue when listings lack status-filter
        metrics.grossRevenue = orders
          .filter((o: any) => o.status === 'DELIVERED')
          .reduce((sum: number, o: any) => sum + Number(o.total ?? 0), 0);
      } catch (e) { errs.push((e as ApiError).message); }

      if (!cancelled) {
        setM(metrics);
        setErrors(errs);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <><PageHeader title="Dashboard" subtitle="Overview of the GenY super-app" /><LoadingState /></>;
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Real-time overview of GenY operations" />

      {errors.length > 0 && (
        <div style={{ background: '#fff3cd', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          <strong>Some API calls failed:</strong> {errors.join(' | ')} <span style={{ color: '#95a0b5' }}>— backend may be offline.</span>
        </div>
      )}

      <div className="stat-grid">
        <StatCard label="Total users"        value={m.totalUsers} delta="+12 this week" icon="👤" />
        <StatCard label="Active drivers"     value={m.totalDrivers} delta="+3 online" icon="🚗" />
        <StatCard label="Restaurants"       value={m.totalRestaurants} icon="🍔" />
        <StatCard label="Active trips"      value={m.activeTrips} delta="real-time" icon="🛣" />
        <StatCard label="Active deliveries" value={m.activeOrders} delta="real-time" icon="🍽" />
        <StatCard label="Gross revenue (delivered)" value={`$${m.grossRevenue.toFixed(2)}`} delta="today" icon="💰" />
      </div>

      <div className="grid-2 mt-4">
        <div className="card">
          <div className="bold">Operational overview</div>
          <p className="text-muted text-sm mt-2">
            Welcome to the GenY admin console. Use the left navigation to drill into users, drivers,
            restaurants, trips, orders, payments, and ratings. Real-time data is backed by the
            NestJS service running on <code>http://localhost:3000</code>.
          </p>
          <ul className="text-sm mt-2" style={{ paddingLeft: 16 }}>
            <li>Approve new driver applications in the Drivers tab</li>
            <li>Moderate restaurants and toggle their open/closed status</li>
            <li>Refund problematic payments</li>
            <li>Moderate low-rated reviews or complaints</li>
          </ul>
        </div>
        <div className="card">
          <div className="bold">Quick links</div>
          <ul className="text-sm mt-2" style={{ paddingLeft: 16 }}>
            <li><a href="#/drivers">Review pending driver approvals</a></li>
            <li><a href="#/orders">Watch live orders</a></li>
            <li><a href="#/ratings">Flagged reviews</a></li>
            <li><a href="#/settings">System settings</a></li>
          </ul>
        </div>
      </div>
    </>
  );
}
