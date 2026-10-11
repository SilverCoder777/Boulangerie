# Maison Dorée

Boutique de boulangerie en français, réalisée avec React et Vite. Catalogue, filtres, fiches avec allergènes, panier persistant, interface responsive et Stripe Checkout côté serveur (Express).

## Développement

Node.js 24 recommandé (SQLite natif).

```sh
npm ci
cp .env.example .env
npm run dev
```

Vite écoute sur le port 5173 et relaie `/api` vers Express sur le port 3001. Aucun secret n’est nécessaire pour parcourir la boutique ou utiliser le panier. Les informations commerciales sont des exemples à adapter.

```sh
npm test
npm run build
APP_URL=http://localhost:3001 npm start
```

Le serveur Express sert également la version compilée. En production, définissez `APP_URL` à l’origine HTTPS réelle de votre site, et utilisez un reverse proxy HTTPS.

## Paiement Stripe

1. Configurez `STRIPE_SECRET_KEY` dans les variables sécurisées du serveur (jamais de préfixe `VITE_`, jamais dans Git). Commencez avec une clé `sk_test_…`.
2. Définissez `APP_URL` à l’origine de la boutique. Les liens de retour sont construits à partir de cette configuration, pas de la requête utilisateur.
3. Activez `CHECKOUT_ENABLED=true` pour tester le parcours. Utilisez une carte de test Stripe, par exemple `4242 4242 4242 4242`, une date future et un CVC de test. Ne testez pas avec une vraie carte.
4. Configurez également `STRIPE_WEBHOOK_SECRET` et déclarez dans Stripe le webhook HTTPS `/api/stripe/webhook`, avec les événements `checkout.session.completed`, `checkout.session.async_payment_succeeded` et `checkout.session.expired`. En local, Stripe CLI peut relayer ces événements vers le port 3001.

Le serveur construit une session Checkout en euros depuis son propre catalogue et vérifie les identifiants et quantités. Stripe héberge le formulaire bancaire. Le retour à la boutique consulte Stripe pour confirmer le statut du paiement ; le paramètre de l’URL seul ne confirme jamais un paiement.

La connexion réelle à Stripe n’a pas été testée sans clé. Les tests automatisés utilisent un client Stripe simulé pour vérifier le contrat et les erreurs. Aucun paiement réel n’a été réalisé.

## Avant une ouverture commerciale

Les commandes sont enregistrées dans `data/orders.sqlite` (fichier ignoré par Git). Le webhook vérifie la signature Stripe, le montant, la session et traite chaque événement de façon idempotente. La base conserve le panier, le total, le statut et l’e-mail fourni par Stripe, sans données de carte. Sauvegardez cette base sur un stockage durable en production. Les ventes restent désactivées par défaut ; une clé réelle exige HTTPS et le secret du webhook. La boutique ne possède pas encore de tableau d’administration ni de gestion des stocks.

- Renseignez le nom réel, l’adresse, les horaires, les coordonnées, les disponibilités, les prix, les descriptions et les allergènes vérifiés. Les visuels générés sont illustratifs et doivent être remplacés par les photos de vos vrais produits.
- Complétez mentions légales, CGV, politique de confidentialité et procédure de retrait. Remplacez le lien Instagram générique.
- Validez la réception du webhook réel et la sauvegarde/restauration de la base ; ajoutez le suivi des remboursements et la préparation des commandes. Le retour navigateur est une indication pour le client : utilisez les commandes confirmées par webhook pour préparer les retraits.
- Configurez un prestataire de newsletter avec consentement, désinscription et politique de conservation. L’endpoint actuel renvoie explicitement « inscriptions non ouvertes » et ne stocke aucun e-mail.
- Ajoutez gestion des stocks, créneaux de retrait, notifications et outils d’administration selon le fonctionnement réel de la boulangerie. Puis testez le paiement de bout en bout en mode test avant d’utiliser une clé de production.

## Structure

- `src/App.jsx` : boutique, panier, détails et statut du paiement.
- `src/styles.css` : identité visuelle et affichage mobile.
- `src/catalog.js` : catalogue partagé ; montants exprimés en centimes.
- `server/app.js` : API Checkout, contrôle des prix et confirmation Stripe.
- `server/orders.js` : stockage SQLite et traitement idempotent des confirmations.
- `server/*.test.js` : tests du paiement, des signatures et de la persistance.

Les polices et visuels sont intégrés localement : aucun chargement de Google Fonts ou d’Unsplash à l’ouverture du site. Le visuel `public/images/bakery-grid.png` a été généré pour cette démonstration. Une grille photographique unique est affichée par cadrage CSS pour limiter les requêtes.
