-- Issue #151: Add currency support for multi-currency asset pricing

ALTER TABLE assets
    ADD COLUMN IF NOT EXISTS price_usd     NUMERIC(20, 8) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS price_currency VARCHAR(10)    DEFAULT 'USD',
    ADD COLUMN IF NOT EXISTS price_amount   NUMERIC(20, 8) DEFAULT 0;

-- Index to allow efficient filtering by currency type
CREATE INDEX IF NOT EXISTS idx_assets_price_currency ON assets (price_currency);

-- Track import jobs created by bulk upload (Issue #153)
CREATE TABLE IF NOT EXISTS import_jobs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename        VARCHAR(255)  NOT NULL,
    format          VARCHAR(10)   NOT NULL CHECK (format IN ('csv', 'json')),
    status          VARCHAR(20)   NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    total_rows      INT           NOT NULL DEFAULT 0,
    processed_rows  INT           NOT NULL DEFAULT 0,
    success_rows    INT           NOT NULL DEFAULT 0,
    failed_rows     INT           NOT NULL DEFAULT 0,
    error_details   TEXT,
    created_assets  TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_user_id  ON import_jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status   ON import_jobs (status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_deleted  ON import_jobs (deleted_at);

-- Rate limit events for analytics dashboard (Issue #150)
CREATE TABLE IF NOT EXISTS rate_limit_events (
    id            BIGSERIAL PRIMARY KEY,
    client_key    VARCHAR(255) NOT NULL,
    endpoint      VARCHAR(500) NOT NULL,
    method        VARCHAR(10)  NOT NULL,
    retry_after   NUMERIC(10,2) DEFAULT 0,
    hit_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rle_client_key ON rate_limit_events (client_key);
CREATE INDEX IF NOT EXISTS idx_rle_endpoint   ON rate_limit_events (endpoint);
CREATE INDEX IF NOT EXISTS idx_rle_hit_at     ON rate_limit_events (hit_at);
