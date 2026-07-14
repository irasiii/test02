// Automated smoke test for the GenY backend.
// Requires the backend running (see docker-compose.yml + .env) and seeded data:
//   docker compose up -d
//   npm install && npm run seed
//   npm run start:prod      (or: npm run start:dev)
//   node scripts/smoke-test.mjs
//
// Uses only Node built-ins (global fetch). No extra deps.

const BASE = process.env.API_BASE || 'http://localhost:3000/api/v1';

const results = [];
let adminToken = null;
let customerToken = null;
let firstDriverId = null;

async function call(method, path, { token, body, expectStatus = 200 } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  const data = json && json.success ? json.data : json;
  const ok = res.status === expectStatus;
  return { ok, status: res.status, data, raw: json };
}

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const tag = ok ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${name}${detail ? ' — ' + detail : ''}`);
}

async function main() {
  // 1) Admin login
  {
    const r = await call('POST', '/auth/login', { body: { identifier: 'admin@geny.app', password: 'P@ssw0rd' } });
    adminToken = r.data?.accessToken || null;
    record('admin login', r.ok && !!adminToken, `status ${r.status}`);
    if (!adminToken) { finish(); return; }
  }

  // 2) Admin list endpoints
  const checks = [
    ['GET /users', '/users', (d) => Array.isArray(d) && d.length > 0],
    ['GET /drivers', '/drivers', (d) => Array.isArray(d)],
    ['GET /restaurants', '/restaurants', (d) => Array.isArray(d) && d.length > 0],
    ['GET /trips (admin)', '/trips', (d) => Array.isArray(d)],
    ['GET /orders (admin)', '/orders', (d) => Array.isArray(d)],
    ['GET /payments (admin)', '/payments', (d) => Array.isArray(d)],
  ];
  for (const [name, path, valid] of checks) {
    const r = await call('GET', path, { token: adminToken });
    record(name, r.ok && valid(r.data), `status ${r.status}, ${Array.isArray(r.data) ? r.data.length + ' rows' : 'n/a'}`);
  }

  // 3) Ratings for first driver
  {
    const d = await call('GET', '/drivers', { token: adminToken });
    firstDriverId = Array.isArray(d.data) && d.data[0]?.id;
    const r = await call('GET', `/ratings?target=DRIVER&targetId=${firstDriverId || 'missing'}`, { token: adminToken });
    record('GET /ratings?target=DRIVER', r.ok && Array.isArray(r.data), `status ${r.status}`);
  }

  // 4) Customer self-registration + public restaurant list
  {
    const email = `smoke_${Date.now()}@geny.app`;
    const reg = await call('POST', '/auth/register', {
      body: { email, phone: `+1${String(Date.now()).slice(-10)}`, firstName: 'Smoke', lastName: 'Test', password: 'P@ssw0rd', role: 'CUSTOMER' },
      expectStatus: 201,
    });
    record('customer register', reg.ok, `status ${reg.status}`);
    const login = await call('POST', '/auth/login', { body: { identifier: email, password: 'P@ssw0rd' } });
    customerToken = login.data?.accessToken || null;
    record('customer login', login.ok && !!customerToken, `status ${login.status}`);

    const me = await call('GET', '/auth/me', { token: customerToken });
    record('customer GET /auth/me', me.ok && me.data?.role === 'CUSTOMER', `role ${me.data?.role}`);

    const rest = await call('GET', '/restaurants', { token: customerToken });
    record('customer GET /restaurants (public-ish)', rest.ok && Array.isArray(rest.data), `status ${rest.status}`);
  }

  // 5) Driver nearby (needs Redis with seeded geo data; may be empty)
  {
    const r = await call('GET', '/drivers/nearby?lat=25.2&lng=55.3&radiusKm=50', { token: adminToken });
    record('GET /drivers/nearby', r.ok && Array.isArray(r.data), `status ${r.status}`);
  }

  finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log('Failing checks: ' + failed.map((f) => f.name).join(', '));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('Smoke test crashed:', e);
  process.exit(1);
});
