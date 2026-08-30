BY FIGGY — DOSSIER FINAL CORRIGÉ

DÉMARRAGE LOCAL
1. Ouvre un Terminal dans ce dossier.
2. Lance :
   npm install
   npm start
3. Ouvre :
   http://localhost:3000

IMPORTANT
- Le site démarre TOUJOURS en français lors de la première visite.
- Une langue choisie manuellement est ensuite mémorisée.
- Langues : FR, EN, ES, IT, DE, AR.
- L'arabe bascule automatiquement l'interface en RTL.
- Le panier et la réservation fonctionnent sur index.html et event.html.
- Maximum 4 places par workshop/date.

PAYPAL SANDBOX
Dans .env :
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=TON_CLIENT_ID_SANDBOX
PAYPAL_CLIENT_SECRET=TON_CLIENT_SECRET_SANDBOX

Ne publie jamais PAYPAL_CLIENT_SECRET.
Le fichier .env est ignoré par Git.

SUR RENDER
Configure les variables directement dans Render :
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
SITE_ORIGIN=https://ton-site.onrender.com

CONTACT
Le formulaire utilise /api/contact.
Pour l'envoi réel, renseigne dans .env :
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
CONTACT_FROM=
CONTACT_TO=bonjour@byfiggy.fr

FICHIERS PRINCIPAUX
- server.js
- package.json
- public/index.html
- public/event.html
- public/contact.html
- public/style.css
- public/script.js
- public/translations.js
- public/i18n.js
- public/contact.js
- public/page.js
- public/assets/ate-attitude.jpg
- public/assets/ate-technique.jpg
- public/assets/ate-energy.jpg

TESTS
npm run check
npm test


V9 — RÉSERVATION DIRECTE PAYPAL
- Cliquer sur RÉSERVER envoie directement vers PayPal.
- Plus de formulaire intermédiaire prénom/e-mail.
- Quantité par défaut : 1 place lors d'un clic direct sur RÉSERVER.
- Les informations client utiles sont récupérées depuis la réponse PayPal après paiement.
- Le panier reste disponible pour regrouper plusieurs réservations avant paiement.
