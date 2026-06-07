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
