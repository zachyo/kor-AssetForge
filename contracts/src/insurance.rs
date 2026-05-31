use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, String};

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum ClaimStatus {
    Pending,
    Approved,
    Rejected,
    Paid,
}

#[contracttype]
#[derive(Clone)]
pub struct InsurancePolicy {
    pub policy_id: u64,
    pub asset_id: u64,
    pub premium_amount: i128,
    pub coverage_amount: i128,
    pub policyholder: Address,
    pub active: bool,
    pub expires_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct InsuranceClaim {
    pub claim_id: u64,
    pub policy_id: u64,
    pub claimant: Address,
    pub amount_requested: i128,
    pub status: ClaimStatus,
    pub filed_at: u64,
    pub evidence_hash: String,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Policy(u64),
    Claim(u64),
    PolicyCount,
    ClaimCount,
}

#[contract]
pub struct AssetInsurance;

#[contractimpl]
impl AssetInsurance {
    pub fn initialize_insurance(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::PolicyCount, &0u64);
        env.storage().instance().set(&DataKey::ClaimCount, &0u64);
    }

    pub fn purchase_policy(
        env: Env,
        policyholder: Address,
        asset_id: u64,
        premium: i128,
        coverage: i128,
        duration: u64,
    ) -> u64 {
        policyholder.require_auth();

        let count: u64 = env.storage().instance().get(&DataKey::PolicyCount).unwrap_or(0);
        let policy_id = count + 1;
        
        let now = env.ledger().timestamp();
        
        let policy = InsurancePolicy {
            policy_id,
            asset_id,
            premium_amount: premium,
            coverage_amount: coverage,
            policyholder: policyholder.clone(),
            active: true,
            expires_at: now + duration,
        };

        env.storage().persistent().set(&DataKey::Policy(policy_id), &policy);
        env.storage().instance().set(&DataKey::PolicyCount, &policy_id);

        env.events().publish((Symbol::new(&env, "policy_purchased"), policyholder), policy_id);

        policy_id
    }

    pub fn file_claim(
        env: Env,
        claimant: Address,
        policy_id: u64,
        amount: i128,
        evidence_hash: String,
    ) -> u64 {
        claimant.require_auth();

        let policy: InsurancePolicy = env.storage().persistent().get(&DataKey::Policy(policy_id)).expect("policy not found");
        
        if policy.policyholder != claimant {
            panic!("only policyholder can file a claim");
        }
        if !policy.active {
            panic!("policy is not active");
        }
        if amount > policy.coverage_amount {
            panic!("claim exceeds coverage");
        }

        let count: u64 = env.storage().instance().get(&DataKey::ClaimCount).unwrap_or(0);
        let claim_id = count + 1;
        let now = env.ledger().timestamp();

        let claim = InsuranceClaim {
            claim_id,
            policy_id,
            claimant: claimant.clone(),
            amount_requested: amount,
            status: ClaimStatus::Pending,
            filed_at: now,
            evidence_hash,
        };

        env.storage().persistent().set(&DataKey::Claim(claim_id), &claim);
        env.storage().instance().set(&DataKey::ClaimCount, &claim_id);

        env.events().publish((Symbol::new(&env, "claim_filed"), claimant), claim_id);

        claim_id
    }

    pub fn process_claim(env: Env, admin: Address, claim_id: u64, approved: bool) {
        admin.require_auth();
        let expected_admin: Address = env.storage().instance().get(&DataKey::Admin).expect("not initialized");
        if admin != expected_admin {
            panic!("admin only");
        }

        let mut claim: InsuranceClaim = env.storage().persistent().get(&DataKey::Claim(claim_id)).expect("claim not found");
        
        if claim.status != ClaimStatus::Pending {
            panic!("claim already processed");
        }

        if approved {
            claim.status = ClaimStatus::Approved;
            // Payout logic would happen here in a real implementation
        } else {
            claim.status = ClaimStatus::Rejected;
        }

        env.storage().persistent().set(&DataKey::Claim(claim_id), &claim);

        env.events().publish(
            (Symbol::new(&env, "claim_processed"), claim_id),
            approved,
        );
    }
    
    pub fn get_policy(env: Env, policy_id: u64) -> Option<InsurancePolicy> {
        env.storage().persistent().get(&DataKey::Policy(policy_id))
    }

    pub fn get_claim(env: Env, claim_id: u64) -> Option<InsuranceClaim> {
        env.storage().persistent().get(&DataKey::Claim(claim_id))
    }
}
