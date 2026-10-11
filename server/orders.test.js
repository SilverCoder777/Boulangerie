import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Stripe from 'stripe';
import { createOrderStore } from './orders.js';
import { createApp } from './app.js';

test('orders survive restart and webhook replay is idempotent', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'bakery-orders-')); const filename = path.join(dir, 'orders.sqlite'); let store = createOrderStore(filename);
  try {
    const id = store.create([{ id: 'croissant', quantity: 2 }], 380); store.attach(id, 'cs_test_order');
    const event = { id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'cs_test_order', metadata: { order_id: id }, currency: 'eur', amount_total: 380, payment_status: 'paid', customer_details: { email: 'test@example.com' } } } };
    store.record(event); const paidAt = store.get(id).paid_at; store.record(event); assert.equal(store.get(id).paid_at, paidAt);
    store.close(); store = createOrderStore(filename); assert.equal(store.get(id).status, 'paid'); assert.equal(store.get(id).total_cents, 380);
    assert.throws(() => store.record({ ...event, id: 'evt_bad', data: { object: { ...event.data.object, amount_total: 1 } } }), /Amount mismatch/);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});
test('webhook verifies real Stripe signatures and rejects unsigned requests', async () => {
  const stripe = new Stripe('sk_test_dummy'); const secret = 'whsec_local_test'; const orders = createOrderStore();
  const id = orders.create([{ id: 'croissant', quantity: 1 }], 190); orders.attach(id, 'cs_test_webhook');
  const payload = JSON.stringify({ id: 'evt_signed', type: 'checkout.session.completed', data: { object: { id: 'cs_test_webhook', metadata: { order_id: id }, currency: 'eur', amount_total: 190, payment_status: 'paid' } } });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const server = createApp({ stripe, orders, webhookSecret: secret }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/api/stripe/webhook`;
  try {
    assert.equal((await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload })).status, 400);
    assert.equal(orders.get(id).status, 'pending');
    assert.equal((await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': signature }, body: payload })).status, 200);
    assert.equal(orders.get(id).status, 'paid');
  } finally { await new Promise(resolve => server.close(resolve)); orders.close(); }
});
