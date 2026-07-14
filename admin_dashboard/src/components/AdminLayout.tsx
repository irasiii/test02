import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { to: '/',           label: 'Dashboard',     icon: '📊', end: true },
  { to: '/users',      label: 'Users',         icon: '👤' },
  { to: '/drivers',    label: 'Drivers',       icon: '🚗' },
  { to: '/restaurants', label: 'Restaurants',  icon: '🍔' },
  { to: '/trips',      label: 'Trips',         icon: '🛣' },
  { to: '/orders',     label: 'Orders',        icon: '🍽' },
  { to: '/payments',   label: 'Payments',      icon: '💳' },
  { to: '/ratings',    label: 'Ratings',       icon: '⭐' },
];

const sysItems = [
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="app-shell">
      <aside className="app-sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 16px', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, background: 'var(--geny-accent)', borderRadius: 8, fontSize: 16,
          }}>G</span>
          <div>
            <div style={{ lineHeight: 1.1 }}>GenY</div>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>Admin Console</div>
          </div>
        </div>

        <nav style={{ padding: '0 12px', flex: 1 }}>
          <div className="section">Operate</div>
          {navItems.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <span style={{ marginRight: 8 }}>{n.icon}</span> {n.label}
            </NavLink>
          ))}
          <div className="section">System</div>
          {sysItems.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span style={{ marginRight: 8 }}>{n.icon}</span> {n.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Signed in as</div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{user?.email ?? '—'}</div>
          <button
            className="btn btn-sm"
            style={{ marginTop: 10, background: 'rgba(255,255,255,0.08)', color: 'white', border: 'none' }}
            onClick={() => { logout(); navigate('/login'); }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
