CREATE TABLE IF NOT EXISTS liquidity_pools (
    id BIGSERIAL PRIMARY KEY,
    asset_a_id BIGINT NOT NULL REFERENCES assets(id),
    asset_b_id BIGINT NOT NULL REFERENCES assets(id),
    reserve_a BIGINT NOT NULL DEFAULT 0,
    reserve_b BIGINT NOT NULL DEFAULT 0,
    total_lp_tokens BIGINT NOT NULL DEFAULT 0,
    fee_basis_points INT NOT NULL DEFAULT 30,
    creator_address VARCHAR(56) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT unique_pool_pair UNIQUE (asset_a_id, asset_b_id)
);

CREATE INDEX IF NOT EXISTS idx_liquidity_pools_asset_a_id ON liquidity_pools (asset_a_id);
CREATE INDEX IF NOT EXISTS idx_liquidity_pools_asset_b_id ON liquidity_pools (asset_b_id);
CREATE INDEX IF NOT EXISTS idx_liquidity_pools_active ON liquidity_pools (active);
CREATE INDEX IF NOT EXISTS idx_liquidity_pools_deleted_at ON liquidity_pools (deleted_at);

CREATE TABLE IF NOT EXISTS liquidity_positions (
    id BIGSERIAL PRIMARY KEY,
    pool_id BIGINT NOT NULL REFERENCES liquidity_pools(id),
    provider_address VARCHAR(56) NOT NULL,
    lp_tokens BIGINT NOT NULL DEFAULT 0,
    deposited_a BIGINT NOT NULL DEFAULT 0,
    deposited_b BIGINT NOT NULL DEFAULT 0,
    fees_earned BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_liquidity_positions_pool_id ON liquidity_positions (pool_id);
CREATE INDEX IF NOT EXISTS idx_liquidity_positions_provider_address ON liquidity_positions (provider_address);
CREATE INDEX IF NOT EXISTS idx_liquidity_positions_deleted_at ON liquidity_positions (deleted_at);

CREATE TABLE IF NOT EXISTS pool_swaps (
    id BIGSERIAL PRIMARY KEY,
    pool_id BIGINT NOT NULL REFERENCES liquidity_pools(id),
    trader_address VARCHAR(56) NOT NULL,
    input_asset_id BIGINT NOT NULL REFERENCES assets(id),
    output_asset_id BIGINT NOT NULL REFERENCES assets(id),
    input_amount BIGINT NOT NULL,
    output_amount BIGINT NOT NULL,
    fee_amount BIGINT NOT NULL,
    price_impact_bps INT,
    tx_hash VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pool_swaps_pool_id ON pool_swaps (pool_id);
CREATE INDEX IF NOT EXISTS idx_pool_swaps_trader_address ON pool_swaps (trader_address);
CREATE INDEX IF NOT EXISTS idx_pool_swaps_created_at ON pool_swaps (created_at DESC);
