import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

export function createOrderStore(filename = ':memory:') {
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, created_at TEXT NOT NULL, status TEXT NOT NULL,
      items TEXT NOT NULL, total_cents INTEGER NOT NULL, session_id TEXT UNIQUE,
      customer_email TEXT, paid_at TEXT
    );
    CREATE TABLE IF NOT EXISTS stripe_events (id TEXT PRIMARY KEY, received_at TEXT NOT NULL);`);
  return {
    create(items, total) { const id = randomUUID(); db.prepare('INSERT INTO orders(id, created_at, status, items, total_cents) VALUES (?, ?, ?, ?, ?)').run(id, new Date().toISOString(), 'pending', JSON.stringify(items), total); return id; },
    attach(id, sessionId) { db.prepare('UPDATE orders SET session_id = ? WHERE id = ?').run(sessionId, id); },
    failed(id) { db.prepare("UPDATE orders SET status = 'failed' WHERE id = ? AND status = 'pending'").run(id); },
    get(id) { return db.prepare('SELECT * FROM orders WHERE id = ?').get(id); },
    record(event) {
      if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.expired'].includes(event.type)) return;
      const session = event.data.object;
      db.exec('BEGIN IMMEDIATE');
      try {
        if (db.prepare('SELECT id FROM stripe_events WHERE id = ?').get(event.id)) { db.exec('COMMIT'); return; }
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(session.metadata?.order_id || '');
        if (!order) throw new Error('Unknown order');
        if (order.session_id && order.session_id !== session.id) throw new Error('Session mismatch');
        if (session.currency !== 'eur' || session.amount_total !== order.total_cents) throw new Error('Amount mismatch');
        if (session.payment_status === 'paid') db.prepare("UPDATE orders SET status = 'paid', session_id = ?, customer_email = ?, paid_at = ? WHERE id = ? AND status != 'paid'").run(session.id, session.customer_details?.email || null, new Date().toISOString(), order.id);
        else if (event.type === 'checkout.session.expired') db.prepare("UPDATE orders SET status = 'expired' WHERE id = ? AND status = 'pending'").run(order.id);
        db.prepare('INSERT INTO stripe_events(id, received_at) VALUES (?, ?)').run(event.id, new Date().toISOString());
        db.exec('COMMIT');
      } catch (err) { db.exec('ROLLBACK'); throw err; }
    },
    close() { db.close(); },
  };
}
