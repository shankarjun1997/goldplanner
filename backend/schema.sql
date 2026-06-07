CREATE TABLE IF NOT EXISTS users (
  id                 SERIAL PRIMARY KEY,
  email              TEXT UNIQUE NOT NULL,
  password_hash      TEXT NOT NULL,
  is_premium         BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_customer_id TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plans (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  karat              INTEGER NOT NULL DEFAULT 22,
  monthly_amount     NUMERIC NOT NULL,
  months             INTEGER NOT NULL DEFAULT 11,
  bonus_installments NUMERIC NOT NULL DEFAULT 1,
  start_ym           TEXT NOT NULL,
  current_rate       NUMERIC NOT NULL DEFAULT 0,
  payments           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plans_user_idx ON plans(user_id);

CREATE TABLE IF NOT EXISTS gold_rates (
  id            SERIAL PRIMARY KEY,
  karat         INTEGER NOT NULL,
  rate_per_gram NUMERIC NOT NULL,
  source        TEXT NOT NULL,
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gold_rates_karat_idx ON gold_rates(karat, fetched_at DESC);

-- People gold is held for. The family tree.
CREATE TABLE IF NOT EXISTS family_members (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  relation   TEXT NOT NULL,            -- self|wife|husband|daughter|son|mother|father|other
  birth_year INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS family_members_user_idx ON family_members(user_id);

-- Physical/digital gold owned today.
CREATE TABLE IF NOT EXISTS assets (
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

CREATE INDEX IF NOT EXISTS assets_user_idx ON assets(user_id);
CREATE INDEX IF NOT EXISTS assets_member_idx ON assets(member_id);

-- One engine for gift/wedding/daughter/festival/coin/wishlist goals.
CREATE TABLE IF NOT EXISTS goals (
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

CREATE INDEX IF NOT EXISTS goals_user_idx ON goals(user_id);

-- Invoices, hallmark certs. Store object key, not bytes (GCS bucket).
CREATE TABLE IF NOT EXISTS documents (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_id   INTEGER REFERENCES assets(id) ON DELETE CASCADE,
  filename   TEXT NOT NULL,
  gcs_key    TEXT NOT NULL,
  mime       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_user_idx ON documents(user_id);
CREATE INDEX IF NOT EXISTS documents_asset_idx ON documents(asset_id);

-- Phase 3: pledged-gold loans.
CREATE TABLE IF NOT EXISTS gold_loans (
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

CREATE INDEX IF NOT EXISTS gold_loans_user_idx ON gold_loans(user_id);
