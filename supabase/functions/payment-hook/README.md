# 💳 SOLARA TV — Automated Payments (PayPal → Activation Panel)

## Architecture

```
Customer clicks "Pay Now" (pricing.html / offers.html)
        │
        ▼
paypal.js (client-side Smart Buttons — PUBLIC client ID only)
        │  payment on paypal.com
        ▼
onApprove → order captured → success modal
        │
        ├─ Phase 1: "Confirm on WhatsApp" (manual activation, works today)
        │
        └─ Phase 2: POST { planKey, paypalOrderId } → Edge Function
                     │  (secrets: PayPal secret + panel API key, server-side)
                     ▼
            payment-hook (Supabase Edge Function)
                     │  1) verify order via PayPal REST (COMPLETED?)
                     │  2) call Activation Panel: action=new&type=m3u&sub=X&pack=all
                     ▼
            Subscription created on the panel 🎉
```

## Mapping offres → panel

| Plan | Prix | Panel `sub` |
|---|---|---|
| Monthly | €17.00 | 1 |
| Quarterly | €34.99 | 3 |
| Semi-Annual | €55.00 | 6 |
| Annual | €90.00 | 12 |
| 2-Year | €149.00 | 24 |
| Offer 3m / 6m / 12m / 24m | €34 / €50 / €77 / €149 | 3 / 6 / 12 / 24 |

`pack` = `all` (tous les bouquets) — ajustable dans `index.ts` (PLAN_MAP).

## 🚀 Déploiement (une seule fois)

```powershell
# 1) Installer Supabase CLI (si pas déjà fait)
npm install -g supabase

# 2) Se connecter au projet
supabase login
supabase link --project-ref nuadbjtwcksoqheyushw

# 3) Définir les secrets (jamais dans le repo)
supabase secrets set PAYPAL_CLIENT_ID=BAAXn76-Ku89zdizrQJVbtXXyXyi9AnxIqVtx9_t1f1Co1qidffznHbmOU3A8Mh79ubybgQVPQMbGl6ulA
supabase secrets set PAYPAL_SECRET=EE20rA-P2hFKuLYDkHpR_izjh5SqrM1W9W_O-GsZI3KsNOHBjN28Vmi-8xmIm1GO4LDnusYUYfCqkBzt
supabase secrets set ACTIVATION_API_KEY=ac3f9249ef9fcdf23dc816b61827c70a
supabase secrets set ACTIVATION_API_URL=https://activationpanel.ru/api/api.php
supabase secrets set PAYPAL_API=https://api-m.paypal.com

# 4) Déployer la fonction
supabase functions deploy payment-hook
```

## ✅ Activer l'automatisation côté site

Une fois déployée, édite `assets/js/paypal.js` :

```js
automationUrl: 'https://nuadbjtwcksoqheyushw.functions.supabase.co/payment-hook',
```

Puis commit + push. Les paiements créeront les abonnements automatiquement.

## 🧪 Test

1. Fais un petit paiement réel (ou passe `PAYPAL_API=https://api-m.sandbox.paypal.com` + compte sandbox)
2. Vérifie le panel : l'abonnement doit apparaître avec la note `PayPal <orderId> — <montant> EUR (auto)`

## 🔒 Sécurité

- `PAYPAL_SECRET` et `ACTIVATION_API_KEY` sont **serveur-side uniquement** (Edge Function).
- Le `.env` de ce dossier est **git-ignoré** — ne le commite jamais.
- Si des secrets ont fuité quelque part, régénère-les dans PayPal / le panel.
