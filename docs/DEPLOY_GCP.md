# Deploying GoldPlanner to GCP

## Architecture

| Piece | GCP service | Why |
|---|---|---|
| Backend (Express) | **Cloud Run** | Scales to zero, pay-per-request, container-based |
| Database | **Cloud SQL (Postgres 16)** | Managed Postgres; connects to Cloud Run via connector |
| Frontend (Vite build) | **Firebase Hosting** | Free CDN + SSL; rewrites `/api/**` to Cloud Run (no CORS needed) |
| Secrets | **Secret Manager** | JWT, Stripe, DB password, GoldAPI key |

Estimated cost: Cloud Run ~$0 at low traffic (free tier), Cloud SQL smallest instance (`db-f1-micro`) ~$8–10/mo. If $10/mo matters, use Neon/Supabase free Postgres instead of Cloud SQL — only `DATABASE_URL` changes.

## 0. One-time setup

```bash
gcloud auth login
gcloud projects create goldplanner-prod --set-as-default   # or use existing
gcloud services enable run.googleapis.com sqladmin.googleapis.com \
  secretmanager.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
gcloud config set run/region asia-south1     # Mumbai; pick your region
```

## 1. Cloud SQL

```bash
gcloud sql instances create goldplanner-db \
  --database-version=POSTGRES_16 --tier=db-f1-micro --region=asia-south1
gcloud sql users set-password postgres --instance=goldplanner-db --password='STRONG_PW'
gcloud sql databases create goldplanner --instance=goldplanner-db
```

Note the connection name: `PROJECT:asia-south1:goldplanner-db`.

`DATABASE_URL` for Cloud Run (unix socket via the built-in connector):

```
postgres://postgres:STRONG_PW@/goldplanner?host=/cloudsql/PROJECT:asia-south1:goldplanner-db
```

Run the migration once from your laptop using Cloud SQL Auth Proxy:

```bash
cloud-sql-proxy PROJECT:asia-south1:goldplanner-db --port 5433 &
DATABASE_URL=postgres://postgres:STRONG_PW@localhost:5433/goldplanner npm run migrate
```

## 2. Secrets

```bash
printf 'value' | gcloud secrets create JWT_SECRET --data-file=-
# repeat for: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, GOLDAPI_KEY, DATABASE_URL
```

## 3. Deploy backend to Cloud Run

From `backend/` (Dockerfile is already there):

```bash
gcloud run deploy goldplanner-api \
  --source . \
  --allow-unauthenticated \
  --add-cloudsql-instances PROJECT:asia-south1:goldplanner-db \
  --set-secrets DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,STRIPE_SECRET_KEY=STRIPE_SECRET_KEY:latest,STRIPE_WEBHOOK_SECRET=STRIPE_WEBHOOK_SECRET:latest,GOLDAPI_KEY=GOLDAPI_KEY:latest \
  --set-env-vars FREE_PLAN_LIMIT=1,STRIPE_PRICE_MONTHLY=price_xxx,STRIPE_PRICE_ANNUAL=price_xxx,STRIPE_PRICE_LIFETIME=price_xxx,BILLING_SUCCESS_URL=https://YOUR_DOMAIN?upgraded=1,BILLING_CANCEL_URL=https://YOUR_DOMAIN,CORS_ORIGIN=https://YOUR_DOMAIN
```

Cloud Run injects `PORT=8080`; the app already reads `process.env.PORT`, so no code change.

## 4. Frontend on Firebase Hosting

```bash
cd frontend && npm run build
npm i -g firebase-tools && firebase login
firebase init hosting        # public dir: dist, SPA: yes
```

Add the API rewrite in `firebase.json` so the frontend's relative `/api` calls hit Cloud Run on the same origin (this also makes `CORS_ORIGIN` moot):

```json
{
  "hosting": {
    "public": "dist",
    "rewrites": [
      { "source": "/api/**", "run": { "serviceId": "goldplanner-api", "region": "asia-south1" } },
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
```

```bash
firebase deploy --only hosting
```

## 5. Stripe production config

1. Switch dashboard to Live mode; recreate the product + 3 prices; update the `STRIPE_PRICE_*` env vars and `STRIPE_SECRET_KEY` secret with live values.
2. Add a webhook endpoint: `https://YOUR_DOMAIN/api/billing/webhook` (or the Cloud Run URL directly), events `checkout.session.completed` and `customer.subscription.deleted`.
3. Put the new signing secret into the `STRIPE_WEBHOOK_SECRET` secret and redeploy.

## 6. Config checklist

- [ ] `JWT_SECRET` — long random string (`openssl rand -hex 32`), never the dev default
- [ ] `DATABASE_URL` — Cloud SQL socket form (above)
- [ ] `STRIPE_SECRET_KEY` / 3 × `STRIPE_PRICE_*` — **live** values
- [ ] `STRIPE_WEBHOOK_SECRET` — from the live webhook endpoint
- [ ] `BILLING_SUCCESS_URL` / `BILLING_CANCEL_URL` — your real domain
- [ ] `CORS_ORIGIN` — your domain (defensive even with rewrites)
- [ ] `GOLDAPI_KEY` — and add the hourly rate cache before real traffic (free tier is tightly rate-limited)
- [ ] Custom domain: Firebase Hosting → Add custom domain (auto SSL)

## Gotchas specific to this codebase

1. **Webhook raw body** — already handled correctly (`express.raw` mounted before `express.json`), works on Cloud Run as-is.
2. **Gold rate caching** — `/api/gold/rate` calls goldapi.io per request; on Cloud Run with cold starts you'll burn the free quota fast. Cache into a `gold_rates` table (the README already suggests this) before launch.
3. **Cloud SQL `pg` SSL** — using the unix-socket form needs no SSL config; if you instead use a public IP, add `?sslmode=require`.
4. **Scale-to-zero + lifetime plan webhook** — fine: Stripe retries webhooks, so a cold start won't lose the premium flip.
