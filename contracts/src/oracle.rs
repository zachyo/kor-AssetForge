use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, Vec};

// ---------------------------------------------------------------------------
// Storage Keys
// ---------------------------------------------------------------------------

#[derive(Clone)]
#[contracttype]
pub enum OracleDataKey {
    /// Administrator address
    Admin,
    /// Set of authorized oracle addresses
    AuthorizedOracles,
    /// Latest price record for an asset: OracleDataKey::Price(asset_id)
    Price(u64),
    /// Aggregated (median) price for an asset: OracleDataKey::AggregatedPrice(asset_id)
    AggregatedPrice(u64),
    /// Per-oracle reputation score: OracleDataKey::Reputation(oracle_address)
    Reputation(Address),
    /// All submitted prices for the current round: OracleDataKey::Round(asset_id)
    Round(u64),
    /// Maximum allowed price deviation in basis points before an alert is emitted
    DeviationThresholdBps,
    /// Fallback price used when no valid feed is available: OracleDataKey::Fallback(asset_id)
    Fallback(u64),
    /// Timestamp of the last price update: OracleDataKey::LastUpdate(asset_id)
    LastUpdate(u64),
}

// ---------------------------------------------------------------------------
// Data Structures
// ---------------------------------------------------------------------------

/// A single price submission from one oracle.
#[derive(Clone)]
#[contracttype]
pub struct PriceSubmission {
    pub oracle: Address,
    pub price: i128,
    pub timestamp: u64,
}

/// The aggregated, canonical price for an asset.
#[derive(Clone)]
#[contracttype]
pub struct AggregatedPrice {
    pub asset_id: u64,
    pub price: i128,
    pub timestamp: u64,
    pub sources: u32,
}

/// Custom error codes for the oracle module.
#[derive(Clone, Copy, Debug, PartialEq)]
#[contracttype]
#[repr(u32)]
pub enum OracleError {
    NotAdmin = 1,
    OracleNotAuthorized = 2,
    NoSubmissionsForAsset = 3,
    PriceDeviationExceedsThreshold = 4,
    InsufficientSources = 5,
    StalePrice = 6,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn get_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get::<OracleDataKey, Address>(&OracleDataKey::Admin)
        .expect("Oracle: admin not set")
}

fn require_admin(env: &Env, caller: &Address) {
    caller.require_auth();
    let admin = get_admin(env);
    if *caller != admin {
        panic!("Oracle: caller is not admin");
    }
}

fn get_authorized_oracles(env: &Env) -> Vec<Address> {
    env.storage()
        .instance()
        .get::<OracleDataKey, Vec<Address>>(&OracleDataKey::AuthorizedOracles)
        .unwrap_or_else(|| Vec::new(env))
}

fn is_authorized(env: &Env, oracle: &Address) -> bool {
    let oracles = get_authorized_oracles(env);
    for i in 0..oracles.len() {
        if oracles.get(i).unwrap() == *oracle {
            return true;
        }
    }
    false
}

/// Compute the median of a sorted slice represented as a Vec<i128>.
/// Assumes values are already sorted ascending.
fn median_sorted(values: &Vec<i128>) -> i128 {
    let len = values.len();
    if len == 0 {
        return 0;
    }
    let mid = len / 2;
    if len % 2 == 0 {
        let a = values.get((mid - 1) as u32).unwrap_or(0);
        let b = values.get(mid as u32).unwrap_or(0);
        (a + b) / 2
    } else {
        values.get(mid as u32).unwrap_or(0)
    }
}

/// Detect outliers: reject submissions whose price deviates more than
/// `threshold_bps` basis points from the current median.
fn filter_outliers(env: &Env, submissions: &Vec<PriceSubmission>, threshold_bps: u32) -> Vec<i128> {
    // Collect all prices into a sortable list.
    let mut prices: Vec<i128> = Vec::new(env);
    for i in 0..submissions.len() {
        prices.push_back(submissions.get(i).unwrap().price);
    }

    // Insertion sort (small datasets expected).
    let n = prices.len();
    for i in 1..n {
        let key = prices.get(i).unwrap();
        let mut j = i;
        while j > 0 {
            let prev = prices.get(j - 1).unwrap();
            if prev > key {
                prices.set(j, prev);
                j -= 1;
            } else {
                break;
            }
        }
        prices.set(j, key);
    }

    let med = median_sorted(&prices);
    if med == 0 {
        return prices;
    }

    let mut filtered: Vec<i128> = Vec::new(env);
    for i in 0..prices.len() {
        let p = prices.get(i).unwrap();
        let deviation_bps = if p >= med {
            ((p - med) * 10_000 / med) as u32
        } else {
            ((med - p) * 10_000 / med) as u32
        };
        if deviation_bps <= threshold_bps {
            filtered.push_back(p);
        }
    }
    filtered
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct Oracle;

#[contractimpl]
impl Oracle {
    /// Initialize the oracle contract with an admin address and default
    /// deviation threshold.
    pub fn initialize(env: Env, admin: Address, deviation_threshold_bps: u32) {
        admin.require_auth();
        env.storage()
            .instance()
            .set(&OracleDataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&OracleDataKey::DeviationThresholdBps, &deviation_threshold_bps);
        env.storage()
            .instance()
            .set(&OracleDataKey::AuthorizedOracles, &Vec::<Address>::new(&env));
    }

    /// Authorize a new oracle address to submit prices.
    pub fn authorize_oracle(env: Env, caller: Address, oracle: Address) {
        require_admin(&env, &caller);
        let mut oracles = get_authorized_oracles(&env);
        // Avoid duplicates.
        if !is_authorized(&env, &oracle) {
            oracles.push_back(oracle);
            env.storage()
                .instance()
                .set(&OracleDataKey::AuthorizedOracles, &oracles);
        }
    }

    /// Remove an oracle from the authorized set (e.g., after slashing).
    pub fn revoke_oracle(env: Env, caller: Address, oracle: Address) {
        require_admin(&env, &caller);
        let oracles = get_authorized_oracles(&env);
        let mut updated: Vec<Address> = Vec::new(&env);
        for i in 0..oracles.len() {
            let o = oracles.get(i).unwrap();
            if o != oracle {
                updated.push_back(o);
            }
        }
        env.storage()
            .instance()
            .set(&OracleDataKey::AuthorizedOracles, &updated);
    }

    /// Submit a price for an asset. Only authorized oracles may call this.
    pub fn submit_price(env: Env, oracle: Address, asset_id: u64, price: i128) {
        oracle.require_auth();
        if !is_authorized(&env, &oracle) {
            panic!("Oracle: not authorized");
        }

        let timestamp = env.ledger().timestamp();
        let submission = PriceSubmission {
            oracle: oracle.clone(),
            price,
            timestamp,
        };

        // Append to the round buffer for this asset.
        let mut round: Vec<PriceSubmission> = env
            .storage()
            .temporary()
            .get::<OracleDataKey, Vec<PriceSubmission>>(&OracleDataKey::Round(asset_id))
            .unwrap_or_else(|| Vec::new(&env));
        round.push_back(submission);
        env.storage()
            .temporary()
            .set(&OracleDataKey::Round(asset_id), &round);

        // Update the per-oracle reputation (increment submission count).
        let reputation: u32 = env
            .storage()
            .instance()
            .get::<OracleDataKey, u32>(&OracleDataKey::Reputation(oracle.clone()))
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&OracleDataKey::Reputation(oracle), &(reputation + 1));
    }

    /// Aggregate all round submissions for an asset into a median price,
    /// filtering outliers. Requires at least `min_sources` valid submissions.
    pub fn aggregate(env: Env, asset_id: u64, min_sources: u32) -> AggregatedPrice {
        let threshold_bps: u32 = env
            .storage()
            .instance()
            .get::<OracleDataKey, u32>(&OracleDataKey::DeviationThresholdBps)
            .unwrap_or(500); // default 5%

        let round: Vec<PriceSubmission> = env
            .storage()
            .temporary()
            .get::<OracleDataKey, Vec<PriceSubmission>>(&OracleDataKey::Round(asset_id))
            .unwrap_or_else(|| Vec::new(&env));

        if round.is_empty() {
            // Try fallback.
            if let Some(fallback) = env
                .storage()
                .instance()
                .get::<OracleDataKey, i128>(&OracleDataKey::Fallback(asset_id))
            {
                return AggregatedPrice {
                    asset_id,
                    price: fallback,
                    timestamp: env.ledger().timestamp(),
                    sources: 0,
                };
            }
            panic!("Oracle: no submissions and no fallback for asset");
        }

        let filtered = filter_outliers(&env, &round, threshold_bps);

        if filtered.len() < min_sources {
            panic!("Oracle: insufficient valid price sources after outlier removal");
        }

        let price = median_sorted(&filtered);
        let timestamp = env.ledger().timestamp();

        let result = AggregatedPrice {
            asset_id,
            price,
            timestamp,
            sources: filtered.len(),
        };

        // Persist and clear round buffer.
        env.storage()
            .instance()
            .set(&OracleDataKey::AggregatedPrice(asset_id), &result);
        env.storage()
            .instance()
            .set(&OracleDataKey::LastUpdate(asset_id), &timestamp);
        env.storage()
            .temporary()
            .remove(&OracleDataKey::Round(asset_id));

        // Emit price deviation alert if new price deviates from previous.
        if let Some(prev) = env
            .storage()
            .instance()
            .get::<OracleDataKey, AggregatedPrice>(&OracleDataKey::Price(asset_id))
        {
            let prev_price = prev.price;
            if prev_price > 0 {
                let deviation_bps = if price >= prev_price {
                    ((price - prev_price) * 10_000 / prev_price) as u32
                } else {
                    ((prev_price - price) * 10_000 / prev_price) as u32
                };
                if deviation_bps > threshold_bps {
                    env.events().publish(
                        (Symbol::new(&env, "price_deviation"),),
                        (asset_id, prev_price, price, deviation_bps),
                    );
                }
            }
        }

        env.storage()
            .instance()
            .set(&OracleDataKey::Price(asset_id), &result);

        result
    }

    /// Return the latest aggregated price for an asset.
    pub fn get_price(env: Env, asset_id: u64) -> AggregatedPrice {
        env.storage()
            .instance()
            .get::<OracleDataKey, AggregatedPrice>(&OracleDataKey::AggregatedPrice(asset_id))
            .expect("Oracle: no aggregated price for asset")
    }

    /// Set a fallback price used when no live oracle data is available.
    pub fn set_fallback_price(env: Env, caller: Address, asset_id: u64, price: i128) {
        require_admin(&env, &caller);
        env.storage()
            .instance()
            .set(&OracleDataKey::Fallback(asset_id), &price);
    }

    /// Override the deviation threshold (in basis points).
    pub fn set_deviation_threshold(env: Env, caller: Address, threshold_bps: u32) {
        require_admin(&env, &caller);
        env.storage()
            .instance()
            .set(&OracleDataKey::DeviationThresholdBps, &threshold_bps);
    }

    /// Return the reputation (submission count) of an oracle.
    pub fn get_reputation(env: Env, oracle: Address) -> u32 {
        env.storage()
            .instance()
            .get::<OracleDataKey, u32>(&OracleDataKey::Reputation(oracle))
            .unwrap_or(0)
    }

    /// Emergency override: admin sets a canonical price directly, bypassing
    /// the oracle round (used during incidents).
    pub fn emergency_price_override(env: Env, caller: Address, asset_id: u64, price: i128) {
        require_admin(&env, &caller);
        let timestamp = env.ledger().timestamp();
        let result = AggregatedPrice {
            asset_id,
            price,
            timestamp,
            sources: 0,
        };
        env.storage()
            .instance()
            .set(&OracleDataKey::AggregatedPrice(asset_id), &result);
        env.storage()
            .instance()
            .set(&OracleDataKey::Price(asset_id), &result);
        env.events().publish(
            (Symbol::new(&env, "emergency_price"),),
            (asset_id, price, caller),
        );
    }
}
