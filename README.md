# GoldPlanner

A gold-chit savings planner. Free users get one plan; **Premium** unlocks unlimited
plans, live gold-rate auto-update, and PDF/CSV export.

- **Backend:** Express + Postgres (`pg`) + Stripe + JWT auth
- **Frontend:** React + Vite + lucide-react

## Quick start

### 1. Database

```bash
cd backend
docker compose up -d        # Postgres on :5432
```

### 2. Backend

```bash
cd backend
cp .env.example .env        # fill in real values (see below)
npm install
npm run migrate             # applies schema.sql
npm run dev                 # API on :3000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                 # app on :8080, proxies /api -> :3000
```

Open http://localhost:8080, sign up, and create a plan.

## Chit math

Classic gold-chit model:

- `totalContribution = monthlyAmount × months`
- `bonusAmount = monthlyAmount × bonusInstallments` (default 1 "free" installment)
- `maturityValue = totalContribution + bonusAmount`
- `gramsAtMaturity = maturityValue ÷ gold rate per gram`

The rate used is the latest installment rate you recorded, falling back to the
plan's current rate field.

## Premium setup

### Stripe (three prices)

In the Stripe dashboard create **one Product**, then add **three prices** on it:

- a **monthly recurring** price → `STRIPE_PRICE_MONTHLY`
- an **annual recurring** price → `STRIPE_PRICE_ANNUAL`
- a **one-time** price → `STRIPE_PRICE_LIFETIME`

The `/api/billing/checkout` route picks subscription mode for monthly/annual and
one-time payment mode for lifetime. The webhook flips the user to premium on
`checkout.session.completed` (both modes) and back off on
`customer.subscription.deleted` (which never fires for lifetime, so it stays on).

Point a Stripe webhook at `POST /api/billing/webhook` and copy the signing secret
into `STRIPE_WEBHOOK_SECRET`. Locally:

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

### Gold rate

Sign up at [goldapi.io](https://www.goldapi.io), copy the access token into
`GOLDAPI_KEY`. The free tier is rate-limited — for production, cache the rate
(e.g. fetch once an hour into a `gold_rates` table and serve from there) rather
than calling the provider on every request. Swapping providers
(metalpriceapi, metals-api) only means changing the URL + response field mapping
in `backend/src/routes/gold.js`.

## API

| Method | Path                     | Auth     | Notes                                  |
| ------ | ------------------------ | -------- | -------------------------------------- |
| POST   | `/api/auth/signup`       | —        | `{ email, password }` → `{ token, user }` |
| POST   | `/api/auth/login`        | —        | `{ email, password }` → `{ token, user }` |
| GET    | `/api/auth/me`           | Bearer   | current user                           |
| GET    | `/api/plans`             | Bearer   | list plans                             |
| POST   | `/api/plans`             | Bearer   | create (402 if free limit hit)         |
| PUT    | `/api/plans/:id`         | Bearer   | update fields / payments               |
| DELETE | `/api/plans/:id`         | Bearer   | delete                                 |
| POST   | `/api/billing/checkout`  | Bearer   | `{ plan: monthly\|annual\|lifetime }`  |
| POST   | `/api/billing/webhook`   | Stripe   | raw body, signature-verified           |
| GET    | `/api/gold/rate?karat=22\|24` | Bearer | premium only (402 otherwise)        |

## Environment

See `backend/.env.example`. Key vars: `DATABASE_URL`, `JWT_SECRET`,
`FREE_PLAN_LIMIT`, the four `STRIPE_*` price/secret vars, `STRIPE_WEBHOOK_SECRET`,
`BILLING_SUCCESS_URL` / `BILLING_CANCEL_URL`, and `GOLDAPI_KEY`.
