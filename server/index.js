import 'dotenv/config';
import Stripe from 'stripe';
import { mkdirSync, chmodSync } from 'node:fs';
import { createOrderStore } from './orders.js';
import { createApp } from './app.js';
const key = process.env.STRIPE_SECRET_KEY;
const stripe = key ? new Stripe(key, { maxNetworkRetries: 2, timeout: 20000 }) : null;
const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
const url = new URL(appUrl);
if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('APP_URL doit être une origine HTTP(S) sans chemin ni identifiants.');
const checkoutEnabled = process.env.CHECKOUT_ENABLED === 'true';
if (key?.startsWith('sk_live_') && checkoutEnabled && (!process.env.STRIPE_WEBHOOK_SECRET || url.protocol !== 'https:')) throw new Error('Les ventes réelles exigent HTTPS et STRIPE_WEBHOOK_SECRET.');
mkdirSync(new URL('../data/', import.meta.url), { recursive: true, mode: 0o700 });
const dbPath = new URL('../data/orders.sqlite', import.meta.url).pathname;
const orders = createOrderStore(dbPath);
chmodSync(dbPath, 0o600);
createApp({ stripe, appUrl, checkoutEnabled, orders, webhookSecret: process.env.STRIPE_WEBHOOK_SECRET }).listen(Number(process.env.PORT) || 3001, '0.0.0.0', () => {
  console.log(`Maison Dorée API — port ${Number(process.env.PORT) || 3001} — Stripe ${stripe ? 'configuré' : 'non configuré'} — ventes ${checkoutEnabled ? 'activées' : 'désactivées'}`);
});
