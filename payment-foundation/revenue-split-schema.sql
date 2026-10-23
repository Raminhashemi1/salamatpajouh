-- Optional revenue split schema EXTENSION; apply through reviewed migration only.
-- Payout execution is intentionally NOT implemented.
CREATE TABLE revenue_split_profiles (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE revenue_split_profile_shares (
 profile_id TEXT NOT NULL REFERENCES revenue_split_profiles(id),
 beneficiary_id TEXT NOT NULL,
 share_bps INTEGER NOT NULL CHECK(share_bps BETWEEN 1 AND 10000),
 PRIMARY KEY(profile_id,beneficiary_id)
);
-- In application service transaction, require 2 or 3 participants and sum=10000
-- before a profile is marked active. Schema rows alone are not enough.
CREATE TABLE revenue_order_split_snapshots (
 order_id TEXT PRIMARY KEY REFERENCES payment_orders(id),
 source TEXT NOT NULL CHECK(source IN ('default','order_override')),
 override_reason TEXT,
 approved_by TEXT,
 approved_at TEXT,
 distributable_amount_minor INTEGER,
 currency TEXT NOT NULL CHECK(currency IN ('IRR','USD','EUR')),
 locked_at TEXT NOT NULL,
 CHECK((source='default' AND override_reason IS NULL) OR
       (source='order_override' AND override_reason IS NOT NULL AND approved_by IS NOT NULL))
);
CREATE TABLE revenue_order_split_shares (
 order_id TEXT NOT NULL REFERENCES revenue_order_split_snapshots(order_id),
 beneficiary_id TEXT NOT NULL,
 share_bps INTEGER NOT NULL CHECK(share_bps BETWEEN 1 AND 10000),
 allocated_amount_minor INTEGER CHECK(allocated_amount_minor>=0),
 PRIMARY KEY(order_id,beneficiary_id)
);
CREATE TABLE revenue_split_audit (
 id TEXT PRIMARY KEY,
 order_id TEXT,
 actor_id TEXT NOT NULL,
 action TEXT NOT NULL,
 details_json TEXT NOT NULL,
 created_at TEXT NOT NULL
);
-- Before enabling, provision an authenticated beneficiary registry with verified
-- bank-account tokens (not IBANs in this public schema), a provider adapter,
-- reconciliation, payout status, refunds/chargebacks and permission checks.
