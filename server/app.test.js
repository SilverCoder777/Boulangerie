import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';
async function withServer(options, fn) {
  const server = createApp(options).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await fn(`http://127.0.0.1:${server.address().port}`); } finally { await new Promise(resolve => server.close(resolve)); }
}
const post = (base, body) => fetch(`${base}/api/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
test('checkout uses server prices, EUR and trusted redirects', async () => {
  let captured;
  await withServer({ checkoutEnabled: true, appUrl: 'https://boutique.example', stripe: { checkout: { sessions: { create: async data => { captured = data; return { url: 'https://checkout.stripe.com/c/pay/test' }; } } } } }, async base => {
    const res = await post(base, { items: [{ id: 'croissant', quantity: 2, price: 1 }], success_url: 'https://attacker.example' });
    assert.equal(res.status, 200); assert.equal((await res.json()).url, 'https://checkout.stripe.com/c/pay/test');
    assert.equal(captured.line_items[0].price_data.unit_amount, 190); assert.equal(captured.line_items[0].quantity, 2); assert.equal(captured.line_items[0].price_data.currency, 'eur'); assert.equal(captured.success_url, 'https://boutique.example/?checkout=success&session_id={CHECKOUT_SESSION_ID}');
  });
});
test('rejects empty carts, unknown IDs, duplicate IDs and invalid quantities', async () => {
  await withServer({}, async base => {
    for (const items of [[], [{ id: 'fake', quantity: 1 }], [{ id: 'croissant', quantity: 0 }], [{ id: 'croissant', quantity: 21 }], [{ id: 'croissant', quantity: 1.5 }], [{ id: 'croissant', quantity: '2' }], [{ id: 'croissant', quantity: 1 }, { id: 'croissant', quantity: 1 }], [null]]) assert.equal((await post(base, { items })).status, 400);
  });
});
test('missing Stripe configuration and disabled sales never simulate payment', async () => {
  await withServer({}, async base => { assert.equal((await post(base, { items: [{ id: 'campagne', quantity: 1 }] })).status, 503); const status = await (await fetch(`${base}/api/health`)).json(); assert.equal(status.paymentConfigured, false); assert.equal(status.checkoutEnabled, false); });
  await withServer({ stripe: {} }, async base => assert.equal((await post(base, { items: [{ id: 'campagne', quantity: 1 }] })).status, 503));
});
test('Stripe failure returns useful error without exposing internals', async () => {
  await withServer({ checkoutEnabled: true, stripe: { checkout: { sessions: { create: async () => { throw new Error('secret internal detail'); } } } } }, async base => { const res = await post(base, { items: [{ id: 'croissant', quantity: 1 }] }); assert.equal(res.status, 502); assert.ok(!(await res.text()).includes('secret internal')); });
});
test('payment confirmation checks Stripe rather than trusting the success URL', async () => {
  await withServer({ stripe: { checkout: { sessions: { retrieve: async id => ({ payment_status: id.endsWith('paid') ? 'paid' : 'unpaid' }) } } } }, async base => {
    assert.deepEqual(await (await fetch(`${base}/api/checkout-session/cs_test_1234567890paid`)).json(), { paid: true });
    assert.deepEqual(await (await fetch(`${base}/api/checkout-session/cs_test_1234567890pending`)).json(), { paid: false });
    assert.equal((await fetch(`${base}/api/checkout-session/invalid`)).status, 400);
  });
});
test('newsletter does not pretend to register an email', async () => {
  await withServer({}, async base => { const res = await fetch(`${base}/api/newsletter`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@example.com' }) }); assert.equal(res.status, 503); });
});
