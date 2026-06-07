# GoldPlanner — Design Spec

Date: 2026-06-07

Gold-chit savings planner: a base web app (auth + chit plans + freemium gate)
with a premium patch layered on top (3-tier billing, live gold rate, PDF/CSV export).

## Stack

- **Backend:** Node 20, Express, `pg` (Postgres), `stripe`, `jsonwebtoken`, `bcryptjs`, `cors`, `dotenv`.
- **Frontend:** React 18 + Vite + `lucide-react`. Vite dev server on :8080 proxies `/api` → :3000.
- **DB:** Postgres (docker-compose for local).

## Layout

```
backend/
  .env.example  package.json  schema.sql  docker-compose.yml  README is root
  src/
    index.js        # app wiring; raw-body Stripe webhook mounted before json()
    db.js           # pg Pool from DATABASE_URL
    migrate.js      # applies schema.sql
    middleware.js   # auth (JWT -> req.user), ah (async error wrapper)
    routes/
      auth.js       # POST /signup /login, GET /me
      plans.js      # CRUD + freemium gate
      billing.js    # POST /checkout (3 tiers), webhookHandler
      gold.js       # GET /rate (premium-gated)  [patch]
frontend/
  index.html  vite.config.js  package.json
  src/
    main.jsx  api.js  auth.jsx
    GoldChitPlanner.jsx  PricingModal.jsx [patch]  export.js [patch]  styles.css
```

## Data model

- `users(id, email UNIQUE, password_hash, is_premium DEFAULT false, stripe_customer_id, created_at)`
- `plans(id, user_id FK, name, karat DEFAULT 22, monthly_amount, months DEFAULT 11,
   bonus_installments DEFAULT 1, start_ym TEXT 'YYYY-MM', current_rate DEFAULT 0,
   payments JSONB DEFAULT '{}', created_at)`
  - `payments` shape: `{ "2026-06": { paid: true, rate: 7300 }, ... }`

## Chit math (`derive(plan)`, client-side)

- `schedule` = `months` entries from `start_ym`: `{ index, key:"YYYY-MM", label:"Jun 2026" }`
- `totalContribution = monthlyAmount × months`
- `bonusAmount = monthlyAmount × bonusInstallments` (classic "free installment", default 1)
- `maturityValue = totalContribution + bonusAmount`
- effective `rate` = latest recorded payment rate, else `plan.current_rate`
- `gramsAtMaturity = rate ? maturityValue / rate : 0`

## Freemium gate (`plans.js`)

On `POST /plans`: if user not premium and existing plan count ≥ `FREE_PLAN_LIMIT` (default 1),
return `402 { error: "upgrade_required" }`. Premium users skip the check.

## Auth

JWT (30d) signed on signup/login; `bcryptjs` hashing. Frontend stores token in
`localStorage`, `useAuth` exposes `{ user, loading, login, signup, logout, refresh }`.
`refresh()` re-fetches `/me` — used after Stripe `?upgraded=1` redirect.

## Billing (patch)

`POST /checkout` accepts `{ plan: monthly|annual|lifetime }`; subscription mode for
monthly/annual, one-time payment for lifetime. `webhookHandler`:
- `checkout.session.completed` → set `is_premium=true` (works for both modes)
- `customer.subscription.deleted` → set `is_premium=false` (never fires for lifetime)

## Live gold rate (patch)

`GET /gold/rate?karat=22|24`, premium-gated (402 otherwise), proxies goldapi.io,
returns `{ karat, ratePerGram, source, at }`.

## Export (patch)

Client-side `exportCSV` / `exportPDF` over `derive(plan)`. UI-gated to premium
(cosmetic gate; acceptable for this product).
