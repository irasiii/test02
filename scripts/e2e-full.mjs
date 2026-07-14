// Comprehensive E2E functional test for the GenY backend.
// Covers: auth, users, drivers, restaurants, menu, trips, orders, payments,
// ratings, and the WebSocket tracking gateway — happy paths + negative cases.
import { io } from 'socket.io-client';

const BASE = process.env.API_BASE || 'http://localhost:3000/api/v1';
const results = [];

async function call(method, path, { token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, data: json && json.success ? json.data : json, raw: json };
}

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
}

const P = 'P@ssw0rd';
const login = async (email) => (await call('POST', '/auth/login', { body: { identifier: email, password: P } })).data?.accessToken;

async function main() {
  // ===== AUTH =====
  const [admin, customer, driver, resto] = await Promise.all([
    login('admin@geny.app'), login('customer@geny.app'), login('driver@geny.app'), login('burgers@geny.app'),
  ]);
  check('auth: all four seeded roles log in', !!(admin && customer && driver && resto));
  const bad = await call('POST', '/auth/login', { body: { identifier: 'admin@geny.app', password: 'wrong' } });
  check('auth: wrong password rejected 401', bad.status === 401, `status ${bad.status}`);
  const me = await call('GET', '/auth/me', { token: customer });
  check('auth: /auth/me returns CUSTOMER', me.data?.role === 'CUSTOMER');
  const noTok = await call('GET', '/auth/me', {});
  check('auth: missing token rejected 401', noTok.status === 401, `status ${noTok.status}`);
  const refreshable = await call('POST', '/auth/login', { body: { identifier: 'customer@geny.app', password: P } });
  const refreshed = await call('POST', '/auth/refresh', { body: { refreshToken: refreshable.data?.refreshToken } });
  check('auth: refresh token exchange', refreshed.status === 200 && !!refreshed.data?.accessToken, `status ${refreshed.status}`);

  // ===== USERS =====
  const upd = await call('PATCH', '/users/me', { token: customer, body: { firstName: 'Janet' } });
  check('users: PATCH /users/me updates profile', upd.status === 200 && upd.data?.firstName === 'Janet', `status ${upd.status}`);
  const usersAsCustomer = await call('GET', '/users', { token: customer });
  check('users: customer blocked from admin list', usersAsCustomer.status === 401 || usersAsCustomer.status === 403, `status ${usersAsCustomer.status} (note: 403 would be more correct than 401)`);

  // ===== RESTAURANTS =====
  const restList = await call('GET', '/restaurants', { token: customer });
  const restaurant = restList.data?.[0];
  check('restaurants: public list returns seeded restaurant', restList.status === 200 && !!restaurant?.id);
  const one = await call('GET', `/restaurants/${restaurant.id}`, { token: customer });
  check('restaurants: GET by id', one.status === 200 && one.data?.name === restaurant.name);
  const mine = await call('GET', '/restaurants/me', { token: resto });
  check('restaurants: GET /restaurants/me (owner)', mine.status === 200 && !!mine.data?.id, `status ${mine.status} — route-order bug if not 200`);

  // ===== MENU =====
  const cats = await call('GET', `/restaurants/${restaurant.id}/categories`, { token: customer });
  check('menu: list categories', cats.status === 200 && Array.isArray(cats.data) && cats.data.length > 0, `status ${cats.status}`);
  const items = await call('GET', `/restaurants/${restaurant.id}/items`, { token: customer });
  check('menu: list items', items.status === 200 && items.data?.length >= 2, `status ${items.status}, ${items.data?.length} items`);
  const newCat = await call('POST', `/restaurants/${restaurant.id}/categories`, { token: resto, body: { name: 'E2E Sides' } });
  check('menu: owner adds category', newCat.status === 201 && !!newCat.data?.id, `status ${newCat.status}`);
  const newItem = await call('POST', `/restaurants/${restaurant.id}/items`, { token: resto, body: { name: 'E2E Fries', price: 3.5, categoryId: newCat.data?.id } });
  check('menu: owner adds item', newItem.status === 201 && !!newItem.data?.id, `status ${newItem.status}`);
  const editItem = await call('PATCH', `/restaurants/${restaurant.id}/items/${newItem.data?.id}`, { token: resto, body: { price: 4.0, isAvailable: false } });
  check('menu: owner updates item (UpdateMenuItemDto)', editItem.status === 200 && Number(editItem.data?.price) === 4, `status ${editItem.status}`);
  const delItem = await call('DELETE', `/restaurants/${restaurant.id}/items/${newItem.data?.id}`, { token: resto });
  check('menu: owner deletes item', delItem.status === 200 || delItem.status === 204, `status ${delItem.status}`);
  const foreignAdd = await call('POST', `/restaurants/${restaurant.id}/items`, { token: customer, body: { name: 'Hack', price: 1, categoryId: newCat.data?.id } });
  check('menu: customer blocked from adding items', foreignAdd.status === 401 || foreignAdd.status === 403, `status ${foreignAdd.status}`);

  // ===== DRIVERS =====
  const dOnline = await call('POST', '/drivers/me/online', { token: driver });
  check('drivers: go online', dOnline.status === 200 || dOnline.status === 201, `status ${dOnline.status}`);
  const ping = await call('POST', '/drivers/me/ping', { token: driver, body: { lat: 24.7136, lng: 46.6753, heading: 90 } });
  check('drivers: location ping', ping.status === 200 || ping.status === 201, `status ${ping.status}`);
  const nearby = await call('GET', '/drivers/nearby?lat=24.7136&lng=46.6753&radiusKm=5', { token: customer });
  check('drivers: nearby finds pinged driver', nearby.status === 200 && Array.isArray(nearby.data) && nearby.data.length > 0, `${nearby.data?.length ?? 0} found`);
  const dMe = await call('GET', '/drivers/me', { token: driver });
  const driverId = dMe.data?.id;
  const tripsBefore = dMe.data?.totalTrips;
  check('drivers: own profile', dMe.status === 200 && !!driverId);

  // ===== TRIP LIFECYCLE =====
  const trip = await call('POST', '/trips', { token: customer, body: {
    pickupLat: 24.7136, pickupLng: 46.6753, pickupAddress: 'Olaya St',
    destinationLat: 24.7743, destinationLng: 46.7386, destinationAddress: 'Airport Rd', passengerCount: 1 } });
  check('trips: request returns REQUESTED + fare estimate', trip.status === 201 && trip.data?.status === 'REQUESTED' && Number(trip.data?.fareEstimate) > 0, `fare ${trip.data?.fareEstimate}`);
  const tripId = trip.data?.id;

  // WebSocket: customer subscribes to trip room before driver moves
  const wsResult = await new Promise((resolve) => {
    const s = io('http://localhost:3000/tracking', { transports: ['websocket'], auth: { token: customer } });
    const d = io('http://localhost:3000/tracking', { transports: ['websocket'], auth: { token: driver } });
    const timeout = setTimeout(() => { s.close(); d.close(); resolve({ ok: false, why: 'timeout' }); }, 6000);
    s.on('connect', () => s.emit('join', { room: `trip:${tripId}` }, () => {
      d.emit('driver:location', { lat: 24.72, lng: 46.68, heading: 45, tripId });
    }));
    s.on('trip:location', (p) => { clearTimeout(timeout); s.close(); d.close(); resolve({ ok: p?.lat === 24.72, why: 'got location' }); });
  });
  check('tracking: WS trip:location relayed driver→customer', wsResult.ok, wsResult.why);

  const accept = await call('POST', `/trips/${tripId}/accept`, { token: driver });
  check('trips: driver accepts', (accept.status === 200 || accept.status === 201) && accept.data?.status === 'ACCEPTED', `status ${accept.status}`);
  for (const st of ['DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'STARTED']) {
    const r = await call('PATCH', `/trips/${tripId}/status`, { token: driver, body: { status: st } });
    check(`trips: driver sets ${st}`, r.status === 200 && r.data?.status === st, `status ${r.status}`);
  }
  const done = await call('PATCH', `/trips/${tripId}/status`, { token: driver, body: { status: 'COMPLETED' } });
  check('trips: COMPLETED computes final fare', done.status === 200 && Number(done.data?.finalFare) > 0, `finalFare ${done.data?.finalFare}`);
  const dAfter = await call('GET', '/drivers/me', { token: driver });
  check('trips: driver back ONLINE + totalTrips incremented', dAfter.data?.status === 'ONLINE' && dAfter.data?.totalTrips === tripsBefore + 1, `status ${dAfter.data?.status}, trips ${tripsBefore}→${dAfter.data?.totalTrips}`);

  // Negative: a second trip; customer tries to jump straight to COMPLETED
  const trip2 = await call('POST', '/trips', { token: customer, body: {
    pickupLat: 24.7136, pickupLng: 46.6753, pickupAddress: 'A', destinationLat: 24.75, destinationLng: 46.7, destinationAddress: 'B' } });
  const hack = await call('PATCH', `/trips/${trip2.data?.id}/status`, { token: customer, body: { status: 'COMPLETED' } });
  check('trips: customer cannot self-complete a trip', hack.status === 403 || hack.status === 400, `status ${hack.status} — SECURITY HOLE if 200`);
  const cancel = await call('PATCH', `/trips/${trip2.data?.id}/status`, { token: customer, body: { status: 'CANCELLED', cancelReason: 'e2e' } });
  check('trips: customer cancels own trip', cancel.status === 200 && cancel.data?.status === 'CANCELLED', `status ${cancel.status}`);

  // ===== ORDER LIFECYCLE =====
  const menu = await call('GET', `/restaurants/${restaurant.id}/items`, { token: customer });
  const burger = menu.data?.find((i) => i.isAvailable);
  const order = await call('POST', '/orders', { token: customer, body: {
    restaurantId: restaurant.id, items: [{ menuItemId: burger.id, quantity: 2 }],
    deliveryAddress: 'E2E Home', deliveryLat: 24.72, deliveryLng: 46.68 } });
  check('orders: create computes totals', order.status === 201 && order.data?.status === 'PENDING' && Number(order.data?.total) > Number(order.data?.subtotal), `subtotal ${order.data?.subtotal}, total ${order.data?.total}`);
  const orderId = order.data?.id;

  const tooSmall = await call('POST', '/orders', { token: customer, body: {
    restaurantId: restaurant.id, items: [{ menuItemId: burger.id, quantity: 1 }],
    deliveryAddress: 'X', deliveryLat: 24.72, deliveryLng: 46.68 } });
  check('orders: below-minimum rejected', tooSmall.status === 400, `status ${tooSmall.status}`);
  const custHack = await call('PATCH', `/orders/${orderId}/status`, { token: customer, body: { status: 'ACCEPTED' } });
  check('orders: customer cannot accept own order', custHack.status === 403, `status ${custHack.status}`);

  for (const st of ['ACCEPTED', 'PREPARING', 'READY']) {
    const r = await call('PATCH', `/orders/${orderId}/status`, { token: resto, body: { status: st } });
    check(`orders: restaurant sets ${st}`, r.status === 200 && r.data?.status === st, `status ${r.status}`);
  }
  const assigned = await call('GET', `/orders/${orderId}`, { token: customer });
  check('orders: READY auto-assigns nearest FOOD driver', !!assigned.data?.driverId, assigned.data?.driverId ? `driver ${assigned.data.driverId.slice(0, 8)}` : 'no driver assigned');
  for (const st of ['PICKED_UP', 'ON_THE_WAY', 'DELIVERED']) {
    const r = await call('PATCH', `/orders/${orderId}/status`, { token: driver, body: { status: st } });
    check(`orders: driver sets ${st}`, r.status === 200 && r.data?.status === st, `status ${r.status}`);
  }
  const restoOrders = await call('GET', `/orders/restaurant/${restaurant.id}`, { token: resto });
  check('orders: restaurant order list', restoOrders.status === 200 && restoOrders.data?.some((o) => o.id === orderId));
  const myOrders = await call('GET', '/orders/me', { token: customer });
  check('orders: customer history', myOrders.status === 200 && myOrders.data?.some((o) => o.id === orderId));

  // ===== PAYMENTS =====
  const intent = await call('POST', '/payments/intent', { token: customer, body: { purpose: 'ORDER', referenceId: orderId, amount: Number(order.data?.total), description: 'e2e' } });
  check('payments: create intent (mock Stripe)', intent.status === 201 && !!intent.data?.clientSecret, `status ${intent.status}`);
  const payGet = await call('GET', `/payments/${intent.data?.paymentId ?? intent.data?.id}`, { token: customer });
  check('payments: fetch payment', payGet.status === 200, `status ${payGet.status}`);
  const refund = await call('POST', `/payments/${intent.data?.paymentId ?? intent.data?.id}/refund`, { token: admin, body: {} });
  check('payments: refund', refund.status === 200 || refund.status === 201, `status ${refund.status}`);
  const payList = await call('GET', '/payments', { token: admin });
  check('payments: admin list', payList.status === 200 && Array.isArray(payList.data));

  // ===== RATINGS =====
  const rateDriver = await call('POST', '/ratings', { token: customer, body: { target: 'DRIVER', targetId: driverId, stars: 5, comment: 'great e2e ride' } });
  check('ratings: rate driver', rateDriver.status === 201, `status ${rateDriver.status}`);
  const rateResto = await call('POST', '/ratings', { token: customer, body: { target: 'RESTAURANT', targetId: restaurant.id, stars: 4, comment: 'tasty e2e' } });
  check('ratings: rate restaurant', rateResto.status === 201, `status ${rateResto.status}`);
  const dRated = await call('GET', '/drivers/me', { token: driver });
  check('ratings: driver aggregate updated', Number(dRated.data?.rating) > 0, `rating ${dRated.data?.rating}`);
  const list = await call('GET', `/ratings?target=DRIVER&targetId=${driverId}`, { token: customer });
  check('ratings: list by target', list.status === 200 && list.data?.length > 0);

  // ===== ADMIN VIEWS =====
  const [aTrips, aOrders, aUsers] = await Promise.all([
    call('GET', '/trips', { token: admin }), call('GET', '/orders', { token: admin }), call('GET', '/users', { token: admin }),
  ]);
  check('admin: trips/orders/users lists populated', aTrips.data?.length > 0 && aOrders.data?.length > 0 && aUsers.data?.length > 0,
    `${aTrips.data?.length} trips, ${aOrders.data?.length} orders, ${aUsers.data?.length} users`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n===== ${results.length - failed.length}/${results.length} checks passed =====`);
  if (failed.length) console.log('FAILING: ' + failed.map((f) => f.name).join(' | '));
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error('E2E crashed:', e); process.exit(1); });
