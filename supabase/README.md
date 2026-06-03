# Supabase setup for SOLARA TV

## 1) Create project
1. Go to https://supabase.com → **Start your project** (free, GitHub login).
2. New project: name `solaratv`, region closest to your customers (Europe/Paris recommended), strong DB password.

## 2) Run schema
- Dashboard → **SQL Editor** → **New query**.
- Paste contents of [supabase/schema.sql](./schema.sql) → **Run**.

## 3) Get credentials
- Dashboard → **Project Settings** → **API**.
- Copy **Project URL** and **anon public key**.

## 4) Wire frontend
Edit `assets/js/supabase-client.js`:
```js
window.SUPABASE_CONFIG = {
  url:     'https://xxxxx.supabase.co',
  anonKey: 'eyJhbGciOi...'
};
```

Include in any page that needs DB access:
```html
<script src="assets/js/supabase-client.js"></script>
```

## 5) Promote yourself to admin
After registering your first user via the site, run in SQL Editor:
```sql
update public.profiles set role = 'admin' where email = 'your@email.com';
```

## 6) Optional — auth providers
Dashboard → **Authentication** → **Providers** to enable Google, GitHub, etc.

## Usage examples
```js
// Register
await SolaraDB.register('user@example.com', 'password123', 'username');

// Login
const r = await SolaraDB.login('user@example.com', 'password123');

// List subscriptions (RLS auto-filters by user / role)
const subs = await SolaraDB.listSubscriptions();

// Track page view
SolaraDB.trackPageView(window.location.pathname);
```

## Limits (free tier)
- 500 MB database
- 1 GB file storage
- 5 GB bandwidth/month
- 50,000 monthly active users
- Unlimited API requests
- Project pauses after 7 days of inactivity (instant resume)
