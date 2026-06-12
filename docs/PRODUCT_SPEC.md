# GoldPlanner → Gold Wealth OS — Product & System Spec

Positioning: from "chit calculator" to **Personal Gold Wealth Management for Indian
Families** — plan, track, gift, and preserve gold across generations.

Long-term positioning (decided 2026-06-12): **Family Wealth OS for Indian
families** — gold remains the wedge; family wealth becomes the platform.

## Core architectural insight

The 15 proposed features collapse into **4 engines**. Don't build 15 features;
build 4 systems and render them as 15 experiences:

| Engine | Powers features |
|---|---|
| **Goals** (target grams/₹ + date + occasion + beneficiary) | Gift planner, Wedding planner, Daughter planner, Festival planner, Coin purchase planner, Wishlist |
| **Vault** (family members + assets + documents) | Family Gold Vault, Asset tracker, Invoice vault, Family tree, Nominee/inheritance |
| **Rates** (cached live rate + history) | Net-worth valuation, Growth charts, Price insights |
| **Plans** (existing chit engine) | Chit planner, Chit marketplace comparison |

The dashboard, AI advisor, and loan tracker are views/consumers of these four.

## Data model (additions to schema.sql)

```sql
-- People gold is held for. The family tree.
CREATE TABLE family_members (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  relation   TEXT NOT NULL,            -- self|wife|husband|daughter|son|mother|father|other
  birth_year INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Physical/digital gold owned today.
CREATE TABLE assets (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_id      INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
  kind           TEXT NOT NULL,        -- coin|jewellery|bar|digital|chit_maturity
  description    TEXT NOT NULL,        -- "22g Necklace"
  weight_grams   NUMERIC NOT NULL,
  karat          INTEGER NOT NULL DEFAULT 22,
  purchase_date  DATE,
  purchase_price NUMERIC,
  nominee_id     INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One engine for gift/wedding/daughter/festival/coin/wishlist goals.
CREATE TABLE goals (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_id       INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
  occasion        TEXT NOT NULL,       -- wedding|birthday|akshaya_tritiya|dhanteras|naming|housewarming|baby_shower|retirement|custom
  title           TEXT NOT NULL,       -- "Naukshitha's wedding"
  target_grams    NUMERIC,             -- target in grams (preferred), or…
  target_amount   NUMERIC,             -- …target in ₹
  target_date     DATE NOT NULL,
  linked_asset_kinds TEXT[],           -- which owned assets count toward progress
  recurring       TEXT,                -- null|monthly|yearly  (coin-every-month / every-AT)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invoices, hallmark certs. Store object key, not bytes (GCS bucket).
CREATE TABLE documents (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_id   INTEGER REFERENCES assets(id) ON DELETE CASCADE,
  filename   TEXT NOT NULL,
  gcs_key    TEXT NOT NULL,
  mime       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Phase 3: pledged-gold loans.
CREATE TABLE gold_loans (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lender        TEXT NOT NULL,
  pledged_grams NUMERIC NOT NULL,
  principal     NUMERIC NOT NULL,
  interest_pct  NUMERIC NOT NULL,
  due_date      DATE NOT NULL,
  closed        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`gold_rates` (already shipped) gains long-term value: keep every fetched row and
the growth chart falls out of it for free.

## Goal math (one formula, six features)

```
neededGrams   = targetGrams − ownedGramsCountingToward
neededAmount  = neededGrams × currentRate        (or targetAmount − savedAmount)
monthsLeft    = months(today → targetDate)
monthlySaving = neededAmount ÷ monthsLeft
progressPct   = ownedGrams ÷ targetGrams
```

Re-rendered per occasion: "Daughter planner" = goal with relation=daughter +
occasion=wedding; "Festival planner" = goal with occasion=akshaya_tritiya and
next-occurrence date; "Coin planner" = recurring goal.

## API additions

| Method | Path | Notes |
|---|---|---|
| CRUD | `/api/members` | family members |
| CRUD | `/api/assets` | assets; GET includes `currentValue` from latest cached rate |
| CRUD | `/api/goals` | goals; GET includes computed progress + monthlySaving |
| GET | `/api/networth` | totals by kind + member + grand total ₹ (dashboard) |
| GET | `/api/networth/history` | from gold_rates × assets (growth chart) |
| POST | `/api/documents/upload-url` | signed GCS upload URL (premium) |
| CRUD | `/api/loans` | Phase 3 |
| POST | `/api/advisor` | Phase 2 — Claude API w/ user's goals+assets as context |

## Information architecture (UI)

Current single-screen app becomes 4 tabs (keep current look — dark + gold works):

```
[ Dashboard ]  [ Plans ]  [ Vault ]  [ Goals ]
```

- **Dashboard** — Gold Net Worth card (total grams, ₹ value, breakdown by kind),
  Growth chart (from gold_rates history), next 2 upcoming goals, festival countdown.
- **Plans** — existing chit UI, unchanged.
- **Vault** — member cards w/ their assets, add-asset form, invoice upload,
  family-tree view (member → assets), nominee field per asset.
- **Goals** — goal cards with progress bars + "save ₹X/month" line; create flow
  picks occasion first (occasion drives defaults: wedding→grams, festival→next date).

New components needed: Tabs, ProgressBar, MemberAvatar, StatBreakdownCard,
LineChart (use recharts), FileDrop, OccasionPicker. Reuse existing tokens
(gold accent, dark surface, serif numerals).

## Freemium line

| Free | Premium |
|---|---|
| 1 chit plan, 2 assets, 1 goal | Unlimited everything |
| Manual rate | Live rate + growth chart |
| — | Invoice vault (GCS storage costs real money) |
| — | AI advisor, festival reminders (email/push) |

## Phases (sequenced by dependency, not just value)

**Phase 1 — Track & Plan (ship in ~2 weeks of evenings)**
1. `family_members` + `assets` + Vault tab (asset tracker is the foundation — net worth, goals progress, and family tree all read from it)
2. Net-worth dashboard card + growth chart (needs gold_rates history to accumulate — ship early so data collects)
3. `goals` engine + Goals tab with gift/festival/wedding/daughter presets
4. Festival date table (Akshaya Tritiya, Dhanteras through 2035 — static JSON)

**Phase 2 — Preserve & Advise**
5. Document vault (GCS signed uploads, premium-only)
6. AI advisor (`/api/advisor` → Claude API; context = user's assets/goals/rates; hard-scoped to gold planning, with "not financial advice" disclaimer)
7. Email reminders (festival ≤30 days, goal off-track) — Cloud Scheduler + a `/api/cron/reminders` endpoint
8. Nominee per asset + family tree view

**Phase 3 — Marketplace & Protection**
9. Gold loan tracker + due-date alerts
10. Chit marketplace (static curated list of GRT/Tanishq/Lalitha/Kalyan schemes first; comparison calculator using existing chit math — no partnerships needed for v1)
11. Wealth analytics (allocation by member/kind, CAGR vs FD/SIP comparison)

**Phase 4 — Wealth Platform (decided 2026-06-12)**
12. **Multi-asset wealth engine** — `asset_type` on assets
    (GOLD|SILVER|MUTUAL_FUND|STOCK|FD|CASH|REAL_ESTATE|CRYPTO|OTHER). Makes family
    net worth meaningful; unlocks allocation charts, gold-concentration analysis,
    cross-asset planning. Highest-ROI Phase 4 item.
13. **Storage & evidence** — `photo_url`, `invoice_url`, `storage_location` on
    assets ("Home Locker", "SBI Locker", "Mother's House"). Solves the real
    where-is-it family problem.
14. **Family Wealth Score** (premium) — 0–100 across gold holdings, emergency fund,
    insurance, investments, debt, with per-pillar breakdown. Signature retention
    feature.
15. **Insurance tracker** (premium) — term/health/gold policies: policy number,
    premium, renewal date, coverage; renewal reminders; coverage-gap flags.
16. **Locker management** — bank, locker number, annual fee, renewal date +
    reminders. Pairs with `storage_location`.
17. **Monthly Wealth Report** (premium) — email + PDF: net-worth change, gold
    accumulation, goal progress, upcoming festivals, insurance renewals,
    recommended actions.

**Sprint order (2026-06-12):** Sprint A = refinement #4 per-row payment tracking
+ #5 goal-to-plan linking → Sprint B = #12 + #13 → Sprint C = #14 + #15 →
Sprint D = #17. **Marketplace and enterprise/white-label stay parked** until
traction proves out (≈1,000+ active users, demonstrated retention and
willingness to pay).

**Deliberately cut / changed:**
- **Price prediction (₹ range + confidence %)** — cut. Predictions will be wrong,
  trust is the product. Replaced by historical growth chart + festival-seasonality
  facts, which is what users actually use it for.
- **Forecasting stays cut (re-affirmed 2026-06-12).** No "gold will reach ₹X in
  Y years" anywhere in the product — including the AI advisor. The planning-side
  replacement is **scenario planning** on goals: project a goal's future cost at
  three fixed CAGRs — Conservative 5% / Historical-average 8% / Aggressive 12%
  ("at 8%, the wedding gold may cost ₹24L"). Planning, not prediction.
- **15 features → 4 tabs** — separate "Daughter planner / Wedding planner / Coin
  planner" nav items would make a 6-item app feel like 15 half-built ones.
  They're presets in the Goal create flow instead.

## Risks

1. **Storage cost** — invoice uploads must be premium-gated from day one.
2. **Advisor scope** — must refuse non-gold financial advice; SEBI-adjacent territory.
3. **Rate provider** — goldapi free tier; the 1h cache (shipped) is mandatory, and
   `/api/networth/history` must read only from `gold_rates`, never the provider.
4. **PII** — family member names/relations are sensitive; never log them, and add
   account-delete (cascades already in place).
