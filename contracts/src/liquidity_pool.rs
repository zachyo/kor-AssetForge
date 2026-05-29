use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, Vec};

// ============================================================================
// Data Types
// ============================================================================

#[derive(Clone)]
#[contracttype]
pub struct Pool {
    pub id: u64,
    pub asset_a: u64,
    pub asset_b: u64,
    pub reserve_a: i128,
    pub reserve_b: i128,
    pub total_lp: i128,
    pub fee_bps: u32,
    pub creator: Address,
    pub active: bool,
}

#[derive(Clone)]
#[contracttype]
pub struct LPPosition {
    pub pool_id: u64,
    pub provider: Address,
    pub lp_tokens: i128,
    pub fees_earned: i128,
}

#[derive(Clone)]
#[contracttype]
pub struct SwapResult {
    pub output_amount: i128,
    pub fee_amount: i128,
    pub price_impact_bps: u32,
}

#[derive(Clone)]
#[contracttype]
pub enum LPDataKey {
    Admin,
    PoolNonce,
    Pool(u64),
    Position(u64, Address),  // (pool_id, provider)
    PoolIndex,               // Vec<u64> of all pool IDs
}

// ============================================================================
// Contract
// ============================================================================

#[contract]
pub struct LiquidityPool;

#[contractimpl]
impl LiquidityPool {
    /// Initialize with an admin address.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&LPDataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&LPDataKey::Admin, &admin);
    }

    /// Create a new AMM pool for two assets.
    pub fn create_pool(
        env: Env,
        creator: Address,
        asset_a: u64,
        asset_b: u64,
        fee_bps: u32,
    ) -> u64 {
        creator.require_auth();

        if asset_a == asset_b {
            panic!("pool assets must be different");
        }
        if fee_bps > 10_000 {
            panic!("fee_bps must not exceed 10000");
        }

        // Canonical asset ordering to prevent duplicate pools
        let (a, b) = if asset_a < asset_b {
            (asset_a, asset_b)
        } else {
            (asset_b, asset_a)
        };

        // Check for duplicate pool
        let pool_ids: Vec<u64> = env
            .storage()
            .instance()
            .get(&LPDataKey::PoolIndex)
            .unwrap_or(Vec::new(&env));
        for pid in pool_ids.iter() {
            if let Some(p) = env.storage().persistent().get::<_, Pool>(&LPDataKey::Pool(pid)) {
                if p.asset_a == a && p.asset_b == b {
                    panic!("pool already exists for this pair");
                }
            }
        }

        let pool_id: u64 = env
            .storage()
            .instance()
            .get(&LPDataKey::PoolNonce)
            .unwrap_or(0)
            + 1;
        env.storage()
            .instance()
            .set(&LPDataKey::PoolNonce, &pool_id);

        let pool = Pool {
            id: pool_id,
            asset_a: a,
            asset_b: b,
            reserve_a: 0,
            reserve_b: 0,
            total_lp: 0,
            fee_bps,
            creator: creator.clone(),
            active: true,
        };

        env.storage()
            .persistent()
            .set(&LPDataKey::Pool(pool_id), &pool);

        let mut index: Vec<u64> = pool_ids;
        index.push_back(pool_id);
        env.storage().instance().set(&LPDataKey::PoolIndex, &index);

        env.events().publish(
            (Symbol::new(&env, "pool_created"), pool_id),
            (creator, a, b, fee_bps),
        );

        pool_id
    }

    /// Add liquidity to a pool; issues LP tokens.
    pub fn add_liquidity(
        env: Env,
        provider: Address,
        pool_id: u64,
        amount_a: i128,
        amount_b: i128,
    ) -> i128 {
        provider.require_auth();

        if amount_a <= 0 || amount_b <= 0 {
            panic!("deposit amounts must be positive");
        }

        let mut pool: Pool = env
            .storage()
            .persistent()
            .get(&LPDataKey::Pool(pool_id))
            .expect("pool not found");

        if !pool.active {
            panic!("pool is inactive");
        }

        let lp_tokens = if pool.total_lp == 0 {
            // Initial liquidity — integer approximation of sqrt(a*b)
            Self::isqrt(amount_a.saturating_mul(amount_b))
        } else {
            let lp_a = amount_a
                .saturating_mul(pool.total_lp)
                / pool.reserve_a;
            let lp_b = amount_b
                .saturating_mul(pool.total_lp)
                / pool.reserve_b;
            lp_a.min(lp_b)
        };

        if lp_tokens <= 0 {
            panic!("deposit too small to issue LP tokens");
        }

        pool.reserve_a = pool.reserve_a.saturating_add(amount_a);
        pool.reserve_b = pool.reserve_b.saturating_add(amount_b);
        pool.total_lp = pool.total_lp.saturating_add(lp_tokens);

        env.storage()
            .persistent()
            .set(&LPDataKey::Pool(pool_id), &pool);

        let mut position: LPPosition = env
            .storage()
            .persistent()
            .get(&LPDataKey::Position(pool_id, provider.clone()))
            .unwrap_or(LPPosition {
                pool_id,
                provider: provider.clone(),
                lp_tokens: 0,
                fees_earned: 0,
            });

        position.lp_tokens = position.lp_tokens.saturating_add(lp_tokens);
        env.storage()
            .persistent()
            .set(&LPDataKey::Position(pool_id, provider.clone()), &position);

        env.events().publish(
            (Symbol::new(&env, "liquidity_added"), pool_id),
            (provider, amount_a, amount_b, lp_tokens),
        );

        lp_tokens
    }

    /// Remove liquidity by burning LP tokens; returns (amount_a, amount_b).
    pub fn remove_liquidity(
        env: Env,
        provider: Address,
        pool_id: u64,
        lp_tokens: i128,
    ) -> (i128, i128) {
        provider.require_auth();

        if lp_tokens <= 0 {
            panic!("lp_tokens must be positive");
        }

        let mut pool: Pool = env
            .storage()
            .persistent()
            .get(&LPDataKey::Pool(pool_id))
            .expect("pool not found");

        if pool.total_lp == 0 {
            panic!("pool has no liquidity");
        }

        let mut position: LPPosition = env
            .storage()
            .persistent()
            .get(&LPDataKey::Position(pool_id, provider.clone()))
            .expect("no LP position found");

        if position.lp_tokens < lp_tokens {
            panic!("insufficient LP tokens");
        }

        let withdraw_a = lp_tokens.saturating_mul(pool.reserve_a) / pool.total_lp;
        let withdraw_b = lp_tokens.saturating_mul(pool.reserve_b) / pool.total_lp;

        pool.reserve_a -= withdraw_a;
        pool.reserve_b -= withdraw_b;
        pool.total_lp -= lp_tokens;
        if pool.reserve_a < 0 {
            pool.reserve_a = 0;
        }
        if pool.reserve_b < 0 {
            pool.reserve_b = 0;
        }

        env.storage()
            .persistent()
            .set(&LPDataKey::Pool(pool_id), &pool);

        position.lp_tokens -= lp_tokens;
        env.storage()
            .persistent()
            .set(&LPDataKey::Position(pool_id, provider.clone()), &position);

        env.events().publish(
            (Symbol::new(&env, "liquidity_removed"), pool_id),
            (provider, withdraw_a, withdraw_b),
        );

        (withdraw_a, withdraw_b)
    }

    /// Execute a swap using the constant-product AMM formula.
    pub fn swap(
        env: Env,
        trader: Address,
        pool_id: u64,
        input_asset: u64,
        input_amount: i128,
        min_output: i128,
    ) -> SwapResult {
        trader.require_auth();

        if input_amount <= 0 {
            panic!("input amount must be positive");
        }

        let mut pool: Pool = env
            .storage()
            .persistent()
            .get(&LPDataKey::Pool(pool_id))
            .expect("pool not found");

        if !pool.active {
            panic!("pool is inactive");
        }

        let (reserve_in, reserve_out, is_a_to_b) = if input_asset == pool.asset_a {
            (pool.reserve_a, pool.reserve_b, true)
        } else if input_asset == pool.asset_b {
            (pool.reserve_b, pool.reserve_a, false)
        } else {
            panic!("input asset not in pool");
        };

        if reserve_in <= 0 || reserve_out <= 0 {
            panic!("insufficient pool liquidity");
        }

        let fee_bps = pool.fee_bps as i128;
        let amount_in_after_fee = input_amount
            .saturating_mul(10_000 - fee_bps)
            / 10_000;
        let fee_amount = input_amount - amount_in_after_fee;

        // x * y = k → output = dy = y * dx' / (x + dx')
        let output_amount = amount_in_after_fee
            .saturating_mul(reserve_out)
            / reserve_in.saturating_add(amount_in_after_fee);

        if output_amount <= 0 {
            panic!("swap output too small");
        }

        if min_output > 0 && output_amount < min_output {
            panic!("slippage too high");
        }

        let price_impact_bps = (output_amount.saturating_mul(10_000) / reserve_out) as u32;

        if is_a_to_b {
            pool.reserve_a = pool.reserve_a.saturating_add(input_amount);
            pool.reserve_b -= output_amount;
            if pool.reserve_b < 0 {
                pool.reserve_b = 0;
            }
        } else {
            pool.reserve_b = pool.reserve_b.saturating_add(input_amount);
            pool.reserve_a -= output_amount;
            if pool.reserve_a < 0 {
                pool.reserve_a = 0;
            }
        }

        env.storage()
            .persistent()
            .set(&LPDataKey::Pool(pool_id), &pool);

        env.events().publish(
            (Symbol::new(&env, "swap_executed"), pool_id),
            (trader, input_asset, input_amount, output_amount, fee_amount),
        );

        SwapResult {
            output_amount,
            fee_amount,
            price_impact_bps,
        }
    }

    /// Get pool details.
    pub fn get_pool(env: Env, pool_id: u64) -> Option<Pool> {
        env.storage()
            .persistent()
            .get(&LPDataKey::Pool(pool_id))
    }

    /// Get LP position for a provider.
    pub fn get_position(env: Env, pool_id: u64, provider: Address) -> Option<LPPosition> {
        env.storage()
            .persistent()
            .get(&LPDataKey::Position(pool_id, provider))
    }

    /// Get all pool IDs.
    pub fn get_pool_ids(env: Env) -> Vec<u64> {
        env.storage()
            .instance()
            .get(&LPDataKey::PoolIndex)
            .unwrap_or(Vec::new(&env))
    }

    /// Admin: deactivate a pool.
    pub fn deactivate_pool(env: Env, admin: Address, pool_id: u64) {
        Self::require_admin(&env, &admin);
        let mut pool: Pool = env
            .storage()
            .persistent()
            .get(&LPDataKey::Pool(pool_id))
            .expect("pool not found");
        pool.active = false;
        env.storage()
            .persistent()
            .set(&LPDataKey::Pool(pool_id), &pool);
        env.events()
            .publish((Symbol::new(&env, "pool_deactivated"), pool_id), admin);
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    fn isqrt(n: i128) -> i128 {
        if n < 0 {
            return 0;
        }
        if n == 0 {
            return 0;
        }
        let mut x = n;
        let mut y = (x + 1) / 2;
        while y < x {
            x = y;
            y = (x + n / x) / 2;
        }
        x
    }

    fn require_admin(env: &Env, caller: &Address) {
        caller.require_auth();
        let admin: Address = env
            .storage()
            .instance()
            .get(&LPDataKey::Admin)
            .expect("admin not set");
        if *caller != admin {
            panic!("caller is not admin");
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Address, Env};

    fn setup(env: &Env) -> (LiquidityPoolClient, Address) {
        let id = env.register_contract(None, LiquidityPool);
        let client = LiquidityPoolClient::new(env, &id);
        let admin = Address::generate(env);
        client.initialize(&admin);
        (client, admin)
    }

    #[test]
    fn test_create_pool_and_add_liquidity() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _) = setup(&env);
        let creator = Address::generate(&env);

        let pool_id = client.create_pool(&creator, &1, &2, &30);
        assert_eq!(pool_id, 1);

        let lp = client.add_liquidity(&creator, &pool_id, &1_000_000, &1_000_000);
        assert!(lp > 0);

        let pool = client.get_pool(&pool_id).unwrap();
        assert_eq!(pool.reserve_a, 1_000_000);
        assert_eq!(pool.reserve_b, 1_000_000);
    }

    #[test]
    fn test_swap() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _) = setup(&env);
        let provider = Address::generate(&env);
        let trader = Address::generate(&env);

        let pool_id = client.create_pool(&provider, &1, &2, &30);
        client.add_liquidity(&provider, &pool_id, &10_000_000, &10_000_000);

        let result = client.swap(&trader, &pool_id, &1, &100_000, &0);
        assert!(result.output_amount > 0);
        assert!(result.fee_amount > 0);
    }

    #[test]
    fn test_remove_liquidity() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _) = setup(&env);
        let provider = Address::generate(&env);

        let pool_id = client.create_pool(&provider, &10, &20, &30);
        let lp_tokens = client.add_liquidity(&provider, &pool_id, &5_000_000, &5_000_000);

        let (a, b) = client.remove_liquidity(&provider, &pool_id, &lp_tokens);
        assert!(a > 0);
        assert!(b > 0);
    }

    #[test]
    #[should_panic(expected = "pool already exists for this pair")]
    fn test_duplicate_pool_rejected() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _) = setup(&env);
        let creator = Address::generate(&env);

        client.create_pool(&creator, &1, &2, &30);
        client.create_pool(&creator, &1, &2, &30); // should panic
    }
}
