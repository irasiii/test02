import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import LoginPage from '@/pages/auth/LoginPage';
import AdminLayout from '@/components/AdminLayout';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import UsersPage from '@/pages/users/UsersPage';
import DriversPage from '@/pages/drivers/DriversPage';
import RestaurantsPage from '@/pages/restaurants/RestaurantsPage';
import TripsPage from '@/pages/trips/TripsPage';
import OrdersPage from '@/pages/orders/OrdersPage';
import PaymentsPage from '@/pages/payments/PaymentsPage';
import RatingsPage from '@/pages/ratings/RatingsPage';
import SettingsPage from '@/pages/dashboard/SettingsPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: '#95a0b5' }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><AdminLayout /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="restaurants" element={<RestaurantsPage />} />
        <Route path="trips" element={<TripsPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="ratings" element={<RatingsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
