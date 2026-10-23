-- REFERENCE ONLY: SQLite / Cloudflare D1 schema, NOT deployed
PRAGMA foreign_keys=ON;
CREATE TABLE members (
 user_id TEXT PRIMARY KEY, expires_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE approved_tariffs (
 persian_year INTEGER NOT NULL,
 currency TEXT NOT NULL CHECK(currency IN ('IRR','USD','EUR')),
 annual_amount_minor INTEGER NOT NULL CHECK(annual_amount_minor>0),
 status TEXT NOT NULL CHECK(status IN ('draft','approved','retired')),
 approved_at TEXT,
 PRIMARY KEY(persian_year,currency)
);
CREATE TABLE payment_orders (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES members(user_id),
 idempotency_key TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('new','renewal')),
 tariff_year INTEGER NOT NULL,
 currency TEXT NOT NULL CHECK(currency IN ('IRR','USD','EUR')),
 tariff_amount_minor INTEGER NOT NULL CHECK(tariff_amount_minor>0),
 discount_percent INTEGER NOT NULL CHECK(discount_percent IN (0,10,30)),
 amount_minor INTEGER NOT NULL CHECK(amount_minor>0),
 status TEXT NOT NULL CHECK(status IN ('draft','pending','paid','failed','cancelled')),
 provider TEXT NOT NULL,
 provider_authority TEXT,
 provider_reference TEXT,
 created_at TEXT NOT NULL,
 paid_at TEXT,
 UNIQUE(user_id,idempotency_key),
 UNIQUE(provider,provider_authority),
 UNIQUE(provider,provider_reference),
 FOREIGN KEY(tariff_year,currency) REFERENCES approved_tariffs(persian_year,currency)
);
CREATE INDEX payment_orders_by_user ON payment_orders(user_id,created_at DESC);
-- In a single server-side transaction: after verifying with gateway, change
-- pending -> paid and extend membership ONCE. Browser callback alone is not proof.
