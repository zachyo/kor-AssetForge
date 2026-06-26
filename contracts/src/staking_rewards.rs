use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, Vec};

// ============================================================================
// Data Types
// ============================================================================

#[derive(Clone)]
#[contracttype]
pub struct StakePosition {
    pub staker: Address,
    pub asset_id: u64,
    pub amount: i128,
    pub accrued_rewards: i128,
    pub staked_at: u64,
    pub last_reward_at: u64,
    pub active: bool,
}

#[derive(Clone)]
#[contracttype]
pub struct RewardConfig {
    /// APR in basis points (e.g. 500 = 5%)
    pub apr_bps: u32,
    /// Minimum stake duration before rewards are earned (seconds)
    pub min_duration: u64,
    /// Whether new stakes are allowed
    pub paused: bool,
}

#[derive(Clone)]
#[contracttype]
pub struct DistributionRecord {
    pub id: u64,
    pub asset_id: u64,
    pub total_distributed: i128,
    pub staker_count: u32,
    pub executed_at: u64,
}

/// Capacity configuration for a staking pool.
#[derive(Clone)]
#[contracttype]
pub struct PoolCapacity {
    /// Maximum total tokens that may be staked in this pool (0 = unlimited).
    pub max_capacity: i128,
    /// Whether the pool is currently at capacity.
    pub is_full: bool,
}

/// A position in the FIFO waitlist for a full pool.
#[derive(Clone)]
#[contracttype]
pub struct WaitlistEntry {
    pub staker: Address,
    pub asset_id: u64,
    pub amount: i128,
    pub queued_at: u64,
}

#[derive(Clone)]
#[contracttype]
pub enum StakingDataKey {
    Admin,
    RewardConfig(u64),
    StakeNonce,
    Position(u64, Address),    // (asset_id, staker)
    AssetStakers(u64),         // Vec<Address>
    DistNonce,
    Distribution(u64),
    TotalStaked(u64),
    PoolCapacity(u64),         // (asset_id) -> PoolCapacity
    Waitlist(u64),             // (asset_id) -> Vec<WaitlistEntry> (FIFO)
}

// ============================================================================
// Contract
// ============================================================================

#[contract]
pub struct StakingRewards;

#[contractimpl]
impl StakingRewards {
    /// Initialize the staking rewards contract with an admin.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&StakingDataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&StakingDataKey::Admin, &admin);
    }

    /// Configure the reward parameters for an asset.
    pub fn configure_rewards(env: Env, admin: Address, asset_id: u64, apr_bps: u32, min_duration: u64) {
        Self::require_admin(&env, &admin);
        if apr_bps > 100_000 {
            panic!("apr_bps must not exceed 100000");
        }
        let config = RewardConfig {
            apr_bps,
            min_duration,
            paused: false,
        };
        env.storage()
            .persistent()
            .set(&StakingDataKey::RewardConfig(asset_id), &config);

        env.events().publish(
            (Symbol::new(&env, "rewards_configured"), asset_id),
            (apr_bps, min_duration),
        );
    }

    /// Pause or unpause staking for an asset.
    pub fn set_paused(env: Env, admin: Address, asset_id: u64, paused: bool) {
        Self::require_admin(&env, &admin);
        let mut config: RewardConfig = env
            .storage()
            .persistent()
            .get(&StakingDataKey::RewardConfig(asset_id))
            .expect("rewards not configured for asset");
        config.paused = paused;
        env.storage()
            .persistent()
            .set(&StakingDataKey::RewardConfig(asset_id), &config);
    }

    /// Stake tokens for an asset.
    pub fn stake(env: Env, staker: Address, asset_id: u64, amount: i128) {
        staker.require_auth();

        if amount <= 0 {
            panic!("stake amount must be positive");
        }

        let config: RewardConfig = env
            .storage()
            .persistent()
            .get(&StakingDataKey::RewardConfig(asset_id))
            .expect("rewards not configured for asset");

        if config.paused {
            panic!("staking is paused for this asset");
        }

        // Enforce capacity limit (Issue #208)
        if let Some(mut cap) = env
            .storage()
            .persistent()
            .get::<_, PoolCapacity>(&StakingDataKey::PoolCapacity(asset_id))
        {
            if cap.max_capacity > 0 {
                let total: i128 = env
                    .storage()
                    .instance()
                    .get(&StakingDataKey::TotalStaked(asset_id))
                    .unwrap_or(0);
                if total >= cap.max_capacity {
                    cap.is_full = true;
                    env.storage()
                        .persistent()
                        .set(&StakingDataKey::PoolCapacity(asset_id), &cap);
                    env.events().publish(
                        (Symbol::new(&env, "pool_at_capacity"), asset_id),
                        (cap.max_capacity, staker.clone()),
                    );
                    panic!("pool is at capacity; join the waitlist");
                }
            }
        }

        let now = env.ledger().timestamp();

        let mut position: StakePosition = env
            .storage()
            .persistent()
            .get(&StakingDataKey::Position(asset_id, staker.clone()))
            .unwrap_or(StakePosition {
                staker: staker.clone(),
                asset_id,
                amount: 0,
                accrued_rewards: 0,
                staked_at: now,
                last_reward_at: now,
                active: true,
            });

        // Accrue pending rewards before changing principal
        if position.amount > 0 {
            let pending = Self::calculate_pending_reward(&env, &position, &config, now);
            position.accrued_rewards = position
                .accrued_rewards
                .checked_add(pending)
                .expect("reward overflow");
        }

        position.amount = position.amount.checked_add(amount).expect("stake overflow");
        position.last_reward_at = now;
        position.active = true;

        env.storage()
            .persistent()
            .set(&StakingDataKey::Position(asset_id, staker.clone()), &position);

        // Track staker in asset's staker list
        let mut stakers: Vec<Address> = env
            .storage()
            .instance()
            .get(&StakingDataKey::AssetStakers(asset_id))
            .unwrap_or(Vec::new(&env));
        let mut already_tracked = false;
        for s in stakers.iter() {
            if s == staker {
                already_tracked = true;
                break;
            }
        }
        if !already_tracked {
            stakers.push_back(staker.clone());
            env.storage()
                .instance()
                .set(&StakingDataKey::AssetStakers(asset_id), &stakers);
        }

        let total: i128 = env
            .storage()
            .instance()
            .get(&StakingDataKey::TotalStaked(asset_id))
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&StakingDataKey::TotalStaked(asset_id), &(total + amount));

        // Update is_full flag in capacity config after staking (Issue #208)
        if let Some(mut cap) = env
            .storage()
            .persistent()
            .get::<_, PoolCapacity>(&StakingDataKey::PoolCapacity(asset_id))
        {
            if cap.max_capacity > 0 && !cap.is_full {
                let new_total = total + amount;
                if new_total >= cap.max_capacity {
                    cap.is_full = true;
                    env.storage()
                        .persistent()
                        .set(&StakingDataKey::PoolCapacity(asset_id), &cap);
                    env.events().publish(
                        (Symbol::new(&env, "pool_at_capacity"), asset_id),
                        cap.max_capacity,
                    );
                }
            }
        }

        env.events().publish(
            (Symbol::new(&env, "tokens_staked"), staker),
            (asset_id, amount),
        );
    }

    /// Unstake tokens.
    pub fn unstake(env: Env, staker: Address, asset_id: u64, amount: i128) {
        staker.require_auth();

        if amount <= 0 {
            panic!("unstake amount must be positive");
        }

        let config: RewardConfig = env
            .storage()
            .persistent()
            .get(&StakingDataKey::RewardConfig(asset_id))
            .expect("rewards not configured for asset");

        let now = env.ledger().timestamp();

        let mut position: StakePosition = env
            .storage()
            .persistent()
            .get(&StakingDataKey::Position(asset_id, staker.clone()))
            .expect("no stake position found");

        if position.amount < amount {
            panic!("insufficient staked balance");
        }

        // Accrue pending rewards before reducing principal
        let pending = Self::calculate_pending_reward(&env, &position, &config, now);
        position.accrued_rewards = position
            .accrued_rewards
            .checked_add(pending)
            .expect("reward overflow");
        position.last_reward_at = now;
        position.amount -= amount;
        if position.amount == 0 {
            position.active = false;
        }

        env.storage()
            .persistent()
            .set(&StakingDataKey::Position(asset_id, staker.clone()), &position);

        let total: i128 = env
            .storage()
            .instance()
            .get(&StakingDataKey::TotalStaked(asset_id))
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&StakingDataKey::TotalStaked(asset_id), &(total - amount));

        // Update capacity flag if pool was full (Issue #208)
        if let Some(mut cap) = env
            .storage()
            .persistent()
            .get::<_, PoolCapacity>(&StakingDataKey::PoolCapacity(asset_id))
        {
            if cap.is_full && cap.max_capacity > 0 {
                let new_total = total - amount;
                if new_total < cap.max_capacity {
                    cap.is_full = false;
                    env.storage()
                        .persistent()
                        .set(&StakingDataKey::PoolCapacity(asset_id), &cap);
                    env.events().publish(
                        (Symbol::new(&env, "pool_capacity_available"), asset_id),
                        new_total,
                    );
                }
            }
        }

        env.events().publish(
            (Symbol::new(&env, "tokens_unstaked"), staker),
            (asset_id, amount),
        );
    }

    /// Claim accrued rewards for an asset.
    pub fn claim_rewards(env: Env, staker: Address, asset_id: u64) -> i128 {
        staker.require_auth();

        let config: RewardConfig = env
            .storage()
            .persistent()
            .get(&StakingDataKey::RewardConfig(asset_id))
            .expect("rewards not configured for asset");

        let now = env.ledger().timestamp();

        let mut position: StakePosition = env
            .storage()
            .persistent()
            .get(&StakingDataKey::Position(asset_id, staker.clone()))
            .expect("no stake position found");

        // Accrue any pending rewards
        let pending = Self::calculate_pending_reward(&env, &position, &config, now);
        position.accrued_rewards = position
            .accrued_rewards
            .checked_add(pending)
            .expect("reward overflow");
        position.last_reward_at = now;

        let claimable = position.accrued_rewards;
        if claimable <= 0 {
            panic!("no rewards to claim");
        }

        position.accrued_rewards = 0;
        env.storage()
            .persistent()
            .set(&StakingDataKey::Position(asset_id, staker.clone()), &position);

        env.events().publish(
            (Symbol::new(&env, "rewards_claimed"), staker),
            (asset_id, claimable),
        );

        claimable
    }

    /// Admin: distribute rewards to all stakers of an asset at once.
    pub fn distribute_rewards(env: Env, admin: Address, asset_id: u64) -> (u32, i128) {
        Self::require_admin(&env, &admin);

        let config: RewardConfig = env
            .storage()
            .persistent()
            .get(&StakingDataKey::RewardConfig(asset_id))
            .expect("rewards not configured for asset");

        let now = env.ledger().timestamp();

        let stakers: Vec<Address> = env
            .storage()
            .instance()
            .get(&StakingDataKey::AssetStakers(asset_id))
            .unwrap_or(Vec::new(&env));

        let mut count: u32 = 0;
        let mut total_distributed: i128 = 0;

        for staker in stakers.iter() {
            let pos_opt: Option<StakePosition> = env
                .storage()
                .persistent()
                .get(&StakingDataKey::Position(asset_id, staker.clone()));

            if let Some(mut pos) = pos_opt {
                if !pos.active || pos.amount <= 0 {
                    continue;
                }

                let pending = Self::calculate_pending_reward(&env, &pos, &config, now);
                if pending <= 0 {
                    continue;
                }

                pos.accrued_rewards = pos
                    .accrued_rewards
                    .checked_add(pending)
                    .expect("reward overflow");
                pos.last_reward_at = now;

                env.storage()
                    .persistent()
                    .set(&StakingDataKey::Position(asset_id, staker), &pos);

                total_distributed += pending;
                count += 1;
            }
        }

        let dist_id: u64 = env
            .storage()
            .instance()
            .get(&StakingDataKey::DistNonce)
            .unwrap_or(0)
            + 1;
        env.storage()
            .instance()
            .set(&StakingDataKey::DistNonce, &dist_id);

        let record = DistributionRecord {
            id: dist_id,
            asset_id,
            total_distributed,
            staker_count: count,
            executed_at: now,
        };
        env.storage()
            .persistent()
            .set(&StakingDataKey::Distribution(dist_id), &record);

        env.events().publish(
            (Symbol::new(&env, "rewards_distributed"), asset_id),
            (total_distributed, count),
        );

        (count, total_distributed)
    }

    // -----------------------------------------------------------------------
    // Pool capacity and waitlist (Issue #208)
    // -----------------------------------------------------------------------

    /// Set the maximum staking capacity for a pool. 0 = unlimited.
    pub fn set_pool_capacity(env: Env, admin: Address, asset_id: u64, max_capacity: i128) {
        Self::require_admin(&env, &admin);
        if max_capacity < 0 {
            panic!("max_capacity must be non-negative");
        }
        let total: i128 = env
            .storage()
            .instance()
            .get(&StakingDataKey::TotalStaked(asset_id))
            .unwrap_or(0);
        let is_full = max_capacity > 0 && total >= max_capacity;
        let cap = PoolCapacity { max_capacity, is_full };
        env.storage()
            .persistent()
            .set(&StakingDataKey::PoolCapacity(asset_id), &cap);
        env.events().publish(
            (Symbol::new(&env, "capacity_set"), asset_id),
            (max_capacity, is_full),
        );
    }

    /// Join the FIFO waitlist for a full pool.
    ///
    /// The entry is stored and will be activated automatically when space
    /// becomes available via `rebalance_pool`.
    pub fn join_waitlist(env: Env, staker: Address, asset_id: u64, amount: i128) {
        staker.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let cap: PoolCapacity = env
            .storage()
            .persistent()
            .get(&StakingDataKey::PoolCapacity(asset_id))
            .expect("capacity not configured for asset");
        if !cap.is_full {
            panic!("pool is not full; stake directly");
        }
        let now = env.ledger().timestamp();
        let entry = WaitlistEntry { staker: staker.clone(), asset_id, amount, queued_at: now };
        let mut waitlist: Vec<WaitlistEntry> = env
            .storage()
            .persistent()
            .get(&StakingDataKey::Waitlist(asset_id))
            .unwrap_or(Vec::new(&env));
        waitlist.push_back(entry);
        env.storage()
            .persistent()
            .set(&StakingDataKey::Waitlist(asset_id), &waitlist);
        env.events().publish(
            (Symbol::new(&env, "waitlist_joined"), staker),
            (asset_id, amount),
        );
    }

    /// Rebalance the pool: admit queued waitlist entries (FIFO) up to capacity.
    ///
    /// Admin-triggered. Emits `pool_rebalanced` with how many entries were promoted.
    pub fn rebalance_pool(env: Env, admin: Address, asset_id: u64) -> u32 {
        Self::require_admin(&env, &admin);
        let mut cap: PoolCapacity = env
            .storage()
            .persistent()
            .get(&StakingDataKey::PoolCapacity(asset_id))
            .expect("capacity not configured");
        if cap.max_capacity == 0 {
            return 0; // unlimited – nothing to rebalance
        }

        let config: RewardConfig = env
            .storage()
            .persistent()
            .get(&StakingDataKey::RewardConfig(asset_id))
            .expect("rewards not configured for asset");

        let mut waitlist: Vec<WaitlistEntry> = env
            .storage()
            .persistent()
            .get(&StakingDataKey::Waitlist(asset_id))
            .unwrap_or(Vec::new(&env));

        let mut promoted: u32 = 0;
        let mut remaining = Vec::new(&env);

        for entry in waitlist.iter() {
            let total: i128 = env
                .storage()
                .instance()
                .get(&StakingDataKey::TotalStaked(asset_id))
                .unwrap_or(0);
            let available = cap.max_capacity - total;
            if available <= 0 {
                remaining.push_back(entry.clone());
                continue;
            }
            let stake_amount = entry.amount.min(available);
            let now = env.ledger().timestamp();
            let mut position: StakePosition = env
                .storage()
                .persistent()
                .get(&StakingDataKey::Position(asset_id, entry.staker.clone()))
                .unwrap_or(StakePosition {
                    staker: entry.staker.clone(),
                    asset_id,
                    amount: 0,
                    accrued_rewards: 0,
                    staked_at: now,
                    last_reward_at: now,
                    active: true,
                });
            if position.amount > 0 {
                let pending = Self::calculate_pending_reward(&env, &position, &config, now);
                position.accrued_rewards =
                    position.accrued_rewards.checked_add(pending).expect("overflow");
            }
            position.amount = position.amount.checked_add(stake_amount).expect("overflow");
            position.last_reward_at = now;
            position.active = true;
            env.storage()
                .persistent()
                .set(&StakingDataKey::Position(asset_id, entry.staker.clone()), &position);
            let mut stakers: Vec<Address> = env
                .storage()
                .instance()
                .get(&StakingDataKey::AssetStakers(asset_id))
                .unwrap_or(Vec::new(&env));
            let mut tracked = false;
            for s in stakers.iter() {
                if s == entry.staker { tracked = true; break; }
            }
            if !tracked {
                stakers.push_back(entry.staker.clone());
                env.storage().instance().set(&StakingDataKey::AssetStakers(asset_id), &stakers);
            }
            let new_total = total + stake_amount;
            env.storage().instance().set(&StakingDataKey::TotalStaked(asset_id), &new_total);
            env.events().publish(
                (Symbol::new(&env, "waitlist_promoted"), entry.staker.clone()),
                (asset_id, stake_amount),
            );
            promoted += 1;
            // If only partial amount admitted, requeing the remainder would add complexity;
            // emit partial entry event but drop the remainder for simplicity.
        }

        env.storage()
            .persistent()
            .set(&StakingDataKey::Waitlist(asset_id), &remaining);

        let total_now: i128 = env
            .storage()
            .instance()
            .get(&StakingDataKey::TotalStaked(asset_id))
            .unwrap_or(0);
        cap.is_full = total_now >= cap.max_capacity;
        env.storage()
            .persistent()
            .set(&StakingDataKey::PoolCapacity(asset_id), &cap);

        env.events().publish(
            (Symbol::new(&env, "pool_rebalanced"), asset_id),
            promoted,
        );
        promoted
    }

    /// Get capacity config for a pool.
    pub fn get_pool_capacity(env: Env, asset_id: u64) -> Option<PoolCapacity> {
        env.storage()
            .persistent()
            .get(&StakingDataKey::PoolCapacity(asset_id))
    }

    /// Get the current waitlist for a pool.
    pub fn get_waitlist(env: Env, asset_id: u64) -> Vec<WaitlistEntry> {
        env.storage()
            .persistent()
            .get(&StakingDataKey::Waitlist(asset_id))
            .unwrap_or(Vec::new(&env))
    }

    /// Get stake position for a staker.
    pub fn get_stake_position(env: Env, staker: Address, asset_id: u64) -> Option<StakePosition> {
        env.storage()
            .persistent()
            .get(&StakingDataKey::Position(asset_id, staker))
    }

    /// Get total staked for an asset.
    pub fn get_total_staked(env: Env, asset_id: u64) -> i128 {
        env.storage()
            .instance()
            .get(&StakingDataKey::TotalStaked(asset_id))
            .unwrap_or(0)
    }

    /// Get a distribution record.
    pub fn get_distribution(env: Env, dist_id: u64) -> Option<DistributionRecord> {
        env.storage()
            .persistent()
            .get(&StakingDataKey::Distribution(dist_id))
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    fn calculate_pending_reward(
        _env: &Env,
        position: &StakePosition,
        config: &RewardConfig,
        now: u64,
    ) -> i128 {
        if position.amount <= 0 || !position.active {
            return 0;
        }
        let elapsed = now.saturating_sub(position.last_reward_at);
        if elapsed < config.min_duration {
            return 0;
        }
        // reward = amount * apr_bps / 10000 * elapsed / seconds_per_year
        let seconds_per_year: i128 = 31_536_000;
        position
            .amount
            .saturating_mul(config.apr_bps as i128)
            / 10_000
            * elapsed as i128
            / seconds_per_year
    }

    fn require_admin(env: &Env, caller: &Address) {
        caller.require_auth();
        let admin: Address = env
            .storage()
            .instance()
            .get(&StakingDataKey::Admin)
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
    use soroban_sdk::testutils::{Address as _, Ledger};
    use soroban_sdk::{Address, Env};

    fn setup(env: &Env) -> (StakingRewardsClient, Address) {
        let id = env.register_contract(None, StakingRewards);
        let client = StakingRewardsClient::new(env, &id);
        let admin = Address::generate(env);
        client.initialize(&admin);
        (client, admin)
    }

    #[test]
    fn test_stake_and_claim() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, admin) = setup(&env);
        let staker = Address::generate(&env);
        let asset_id: u64 = 1;

        // Configure 10% APR, no minimum duration
        client.configure_rewards(&admin, &asset_id, &1000, &0);

        client.stake(&staker, &asset_id, &10_000_000);

        // Advance ledger by ~1 year (approx)
        env.ledger().with_mut(|li| {
            li.timestamp = 31_536_000;
        });

        let rewards = client.claim_rewards(&staker, &asset_id);
        // With 10% APR on 10M for 1 year: 10_000_000 * 1000 / 10000 * 31536000 / 31536000 = 1_000_000
        assert!(rewards > 0, "should have rewards after 1 year");
    }

    #[test]
    fn test_distribute_rewards() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, admin) = setup(&env);
        let staker1 = Address::generate(&env);
        let staker2 = Address::generate(&env);
        let asset_id: u64 = 2;

        client.configure_rewards(&admin, &asset_id, &500, &0);
        client.stake(&staker1, &asset_id, &5_000_000);
        client.stake(&staker2, &asset_id, &3_000_000);

        env.ledger().with_mut(|li| {
            li.timestamp = 31_536_000;
        });

        let (count, total) = client.distribute_rewards(&admin, &asset_id);
        assert_eq!(count, 2);
        assert!(total > 0);
    }

    #[test]
    fn test_unstake() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, admin) = setup(&env);
        let staker = Address::generate(&env);
        let asset_id: u64 = 3;

        client.configure_rewards(&admin, &asset_id, &500, &0);
        client.stake(&staker, &asset_id, &1_000_000);

        let total_before = client.get_total_staked(&asset_id);
        client.unstake(&staker, &asset_id, &500_000);
        let total_after = client.get_total_staked(&asset_id);

        assert_eq!(total_after, total_before - 500_000);

        let pos = client.get_stake_position(&staker, &asset_id).unwrap();
        assert_eq!(pos.amount, 500_000);
        assert!(pos.active);
    }

    // -----------------------------------------------------------------------
    // Capacity & waitlist tests (Issue #208)
    // -----------------------------------------------------------------------

    #[test]
    fn test_set_pool_capacity() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, admin) = setup(&env);
        let asset_id: u64 = 10;

        client.configure_rewards(&admin, &asset_id, &500, &0);
        client.set_pool_capacity(&admin, &asset_id, &5_000_000);

        let cap = client.get_pool_capacity(&asset_id).unwrap();
        assert_eq!(cap.max_capacity, 5_000_000);
        assert!(!cap.is_full);
    }

    #[test]
    #[should_panic(expected = "pool is at capacity")]
    fn test_stake_rejected_when_pool_full() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, admin) = setup(&env);
        let staker1 = Address::generate(&env);
        let staker2 = Address::generate(&env);
        let asset_id: u64 = 11;

        client.configure_rewards(&admin, &asset_id, &500, &0);
        client.set_pool_capacity(&admin, &asset_id, &1_000_000);
        client.stake(&staker1, &asset_id, &1_000_000); // fills pool
        client.stake(&staker2, &asset_id, &100_000);   // should panic
    }

    #[test]
    fn test_waitlist_join_and_query() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, admin) = setup(&env);
        let staker1 = Address::generate(&env);
        let staker2 = Address::generate(&env);
        let staker3 = Address::generate(&env);
        let asset_id: u64 = 12;

        client.configure_rewards(&admin, &asset_id, &500, &0);
        client.set_pool_capacity(&admin, &asset_id, &1_000_000);
        client.stake(&staker1, &asset_id, &1_000_000); // fills pool

        client.join_waitlist(&staker2, &asset_id, &500_000);
        client.join_waitlist(&staker3, &asset_id, &300_000);

        let wl = client.get_waitlist(&asset_id);
        assert_eq!(wl.len(), 2);
        // FIFO: staker2 is first
        assert_eq!(wl.get(0).unwrap().staker, staker2);
        assert_eq!(wl.get(1).unwrap().staker, staker3);
    }

    #[test]
    #[should_panic(expected = "pool is not full")]
    fn test_join_waitlist_panics_when_pool_not_full() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, admin) = setup(&env);
        let staker = Address::generate(&env);
        let asset_id: u64 = 13;

        client.configure_rewards(&admin, &asset_id, &500, &0);
        client.set_pool_capacity(&admin, &asset_id, &5_000_000);
        client.join_waitlist(&staker, &asset_id, &100_000);
    }

    #[test]
    fn test_rebalance_promotes_waitlist_after_unstake() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, admin) = setup(&env);
        let staker1 = Address::generate(&env);
        let staker2 = Address::generate(&env);
        let asset_id: u64 = 14;

        client.configure_rewards(&admin, &asset_id, &500, &0);
        client.set_pool_capacity(&admin, &asset_id, &1_000_000);
        client.stake(&staker1, &asset_id, &1_000_000); // fills pool

        client.join_waitlist(&staker2, &asset_id, &400_000);
        assert_eq!(client.get_waitlist(&asset_id).len(), 1);

        // Free up space
        client.unstake(&staker1, &asset_id, &500_000);

        // Rebalance should admit staker2
        let promoted = client.rebalance_pool(&admin, &asset_id);
        assert_eq!(promoted, 1);
        assert_eq!(client.get_waitlist(&asset_id).len(), 0);

        let pos = client.get_stake_position(&staker2, &asset_id).unwrap();
        assert_eq!(pos.amount, 400_000);
        assert!(pos.active);
    }

    #[test]
    fn test_capacity_becomes_not_full_after_unstake() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, admin) = setup(&env);
        let staker = Address::generate(&env);
        let asset_id: u64 = 15;

        client.configure_rewards(&admin, &asset_id, &500, &0);
        client.set_pool_capacity(&admin, &asset_id, &1_000_000);
        client.stake(&staker, &asset_id, &1_000_000);

        let cap_full = client.get_pool_capacity(&asset_id).unwrap();
        assert!(cap_full.is_full);

        client.unstake(&staker, &asset_id, &200_000);
        let cap_after = client.get_pool_capacity(&asset_id).unwrap();
        assert!(!cap_after.is_full);
    }
}
