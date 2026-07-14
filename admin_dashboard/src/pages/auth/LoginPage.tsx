import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('admin@geny.app');
  const [password, setPassword] = useState('P@ssw0rd');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(identifier, password);
      navigate('/');
    } catch (err: any) {
      setError(err?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrapper">
      <form className="login-card" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, background: 'var(--geny-accent)', borderRadius: 10, color: 'white',
            fontSize: 18, fontWeight: 700,
          }}>G</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>GenY Admin</div>
            <div style={{ fontSize: 12, color: 'var(--geny-muted)' }}>Super-app console</div>
          </div>
        </div>
        <label style={{ fontSize: 12, fontWeight: 600 }}>Email or phone</label>
        <input className="input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" />
        <label style={{ fontSize: 12, fontWeight: 600 }}>Password</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        {error && (
          <div style={{ background: '#fde2e2', color: '#ab1f1a', padding: 8, borderRadius: 8, fontSize: 13 }}>{error}</div>
        )}
        <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 8 }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <p style={{ fontSize: 12, color: 'var(--geny-muted)', marginTop: 8, lineHeight: 1.5 }}>
          Demo accounts are seeded by the backend:<br />
          <code>admin@geny.app</code> / <code>P@ssw0rd</code>
        </p>
      </form>
    </div>
  );
}
