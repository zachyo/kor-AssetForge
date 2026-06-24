DROP INDEX IF EXISTS idx_rle_hit_at;
DROP INDEX IF EXISTS idx_rle_endpoint;
DROP INDEX IF EXISTS idx_rle_client_key;
DROP TABLE IF EXISTS rate_limit_events;

DROP INDEX IF EXISTS idx_import_jobs_deleted;
DROP INDEX IF EXISTS idx_import_jobs_status;
DROP INDEX IF EXISTS idx_import_jobs_user_id;
DROP TABLE IF EXISTS import_jobs;

DROP INDEX IF EXISTS idx_assets_price_currency;
ALTER TABLE assets
    DROP COLUMN IF EXISTS price_amount,
    DROP COLUMN IF EXISTS price_currency,
    DROP COLUMN IF EXISTS price_usd;
