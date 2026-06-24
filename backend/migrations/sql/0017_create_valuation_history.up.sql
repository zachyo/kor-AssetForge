-- Issue #152: Asset valuation history tracking

CREATE TABLE IF NOT EXISTS valuation_histories (
    id             BIGSERIAL PRIMARY KEY,
    asset_id       BIGINT        NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    valuation_usd  NUMERIC(20, 8) NOT NULL,
    currency       VARCHAR(10)   NOT NULL DEFAULT 'USD',
    source         VARCHAR(50)   NOT NULL,   -- manual, sale, revaluation, oracle
    notes          TEXT,
    recorded_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at     TIMESTAMPTZ
);

-- Indexes for common query patterns: per-asset history and time-range queries
CREATE INDEX IF NOT EXISTS idx_valuation_histories_asset_id    ON valuation_histories (asset_id);
CREATE INDEX IF NOT EXISTS idx_valuation_histories_recorded_at ON valuation_histories (recorded_at);
CREATE INDEX IF NOT EXISTS idx_valuation_histories_deleted_at  ON valuation_histories (deleted_at);

-- Composite index for the trend query (asset + time window)
CREATE INDEX IF NOT EXISTS idx_valuation_histories_asset_time
    ON valuation_histories (asset_id, recorded_at)
    WHERE deleted_at IS NULL;
