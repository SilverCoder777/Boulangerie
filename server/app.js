import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { products } from '../src/catalog.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function createApp({ stripe = null, appUrl = 'http://localhost:5173', checkoutEnabled = false, orders = null, webhookSecret = null } = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Signature verification requires the unmodified request bytes.
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json', limit: '1mb' }), (req, res) => {
    if (!stripe || !webhookSecret || !orders) return res.status(503).json({ error: 'Webhook non configuré.' });
    let event;
    try { event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], webhookSecret); }
    catch { return res.status(400).json({ error: 'Signature Stripe invalide.' }); }
    try { orders.record(event); res.json({ received: true }); }
    catch { res.status(500).json({ error: 'La confirmation doit être réessayée.' }); }
  });
  app.use(express.json({ limit: '16kb' }));
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/health', (req, res) => res.json({ status: 'ok', paymentConfigured: Boolean(stripe), checkoutEnabled: Boolean(stripe && checkoutEnabled) }));
  // Simple bounded rate limit for the public checkout endpoint.
  const attempts = new Map();
  app.post('/api/checkout', async (req, res) => {
    const now = Date.now();
    for (const [ip, value] of attempts) if (value.reset < now) attempts.delete(ip);
    if (attempts.size > 10000) return res.status(429).json({ error: 'Service occupé. Réessayez dans un instant.' });
    const ip = req.ip; const limit = attempts.get(ip) || { count: 0, reset: now + 60000 };
    limit.count++; attempts.set(ip, limit);
    if (limit.count > 15) return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans une minute.' });
    const items = req.body?.items;
    if (!Array.isArray(items) || !items.length || items.length > products.length) return res.status(400).json({ error: 'Votre panier est invalide ou vide.' });
    const ids = new Set(); const lines = [];
    for (const item of items) {
      const product = products.find(p => p.id === item?.id);
      if (!product || ids.has(item.id) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) return res.status(400).json({ error: 'Un article ou une quantité est invalide.' });
      ids.add(item.id);
      lines.push({ quantity: item.quantity, price_data: { currency: 'eur', unit_amount: product.price, product_data: { name: product.name, description: product.description, metadata: { product_id: product.id } } } });
    }
    if (!stripe) return res.status(503).json({ error: 'Le paiement sera disponible à l’ouverture de la boutique. Votre panier est conservé.' });
    if (!checkoutEnabled) return res.status(503).json({ error: 'La boutique prépare son ouverture. Le paiement n’est pas encore activé.' });
    // Prices and redirects come exclusively from trusted server configuration.
    let orderId;
    try {
      orderId = orders?.create(items.map(item => ({ id: item.id, quantity: item.quantity })), lines.reduce((sum, line) => sum + line.quantity * line.price_data.unit_amount, 0));
      const session = await stripe.checkout.sessions.create({ metadata: orderId ? { order_id: orderId } : {}, mode: 'payment', payment_method_types: ['card'], locale: 'fr', line_items: lines, success_url: `${appUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${appUrl}/?checkout=cancelled`, billing_address_collection: 'required', payment_intent_data: { description: 'Maison Dorée — Retrait en boutique' }, custom_text: { submit: { message: 'Retrait en boutique uniquement. Conservez votre reçu de paiement.' } } });
      if (orderId) orders.attach(orderId, session.id);
      res.json({ url: session.url });
    } catch { if (orderId) orders.failed(orderId); res.status(502).json({ error: 'Stripe est momentanément indisponible. Veuillez réessayer.' }); }
  });
  app.get('/api/checkout-session/:id', async (req, res) => {
    if (!stripe) return res.status(503).json({ error: 'Paiement non configuré.' });
    if (!/^cs_(test_|live_)?[A-Za-z0-9]{10,200}$/.test(req.params.id)) return res.status(400).json({ error: 'Session invalide.' });
    try { const session = await stripe.checkout.sessions.retrieve(req.params.id); res.json({ paid: session.payment_status === 'paid' }); } catch { res.status(502).json({ error: 'Confirmation de paiement indisponible.' }); }
  });
  // No false signup acknowledgement and no personal data stored without a configured provider.
  app.post('/api/newsletter', (req, res) => res.status(503).json({ error: 'La newsletter arrive bientôt. Les inscriptions ne sont pas encore ouvertes.' }));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Route inconnue.' }));
  app.use(express.static(path.join(root, 'dist')));
  app.get('/{*path}', (req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
  app.use((err, req, res, next) => { if (res.headersSent) return next(err); res.status(err.status === 400 ? 400 : 500).json({ error: err.status === 400 ? 'Requête JSON invalide.' : 'Une erreur est survenue.' }); });
  return app;
}
