use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, String, Vec,
};

// ---------------------------------------------------------------------------
// Storage Keys
// ---------------------------------------------------------------------------

#[derive(Clone)]
#[contracttype]
pub enum VerifDataKey {
    Admin,
    /// Authorized verifiers set
    Verifier(Address),
    /// Verification request by asset id
    Request(u64),
    /// Approved verification record by asset id
    Verified(u64),
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub enum VerifStatus {
    Pending,
    Approved,
    Rejected,
}

#[derive(Clone)]
#[contracttype]
pub struct VerificationRequest {
    pub asset_id: u64,
    pub requester: Address,
    pub evidence_url: String,
    pub submitted_at: u64,
    pub status: VerifStatus,
    pub reviewed_by: Option<Address>,
    pub reviewed_at: Option<u64>,
    pub notes: String,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct Verification;

#[contractimpl]
impl Verification {
    /// Initialize contract with an admin address.
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        env.storage().instance().set(&VerifDataKey::Admin, &admin);
    }

    /// Admin registers a trusted verifier.
    pub fn add_verifier(env: Env, admin: Address, verifier: Address) {
        admin.require_auth();
        let stored: Address = env.storage().instance().get(&VerifDataKey::Admin).unwrap();
        assert_eq!(admin, stored, "unauthorized");
        env.storage().instance().set(&VerifDataKey::Verifier(verifier), &true);
    }

    /// Admin removes a verifier.
    pub fn remove_verifier(env: Env, admin: Address, verifier: Address) {
        admin.require_auth();
        let stored: Address = env.storage().instance().get(&VerifDataKey::Admin).unwrap();
        assert_eq!(admin, stored, "unauthorized");
        env.storage().instance().remove(&VerifDataKey::Verifier(verifier));
    }

    /// Asset owner requests verification.
    pub fn request_verification(
        env: Env,
        requester: Address,
        asset_id: u64,
        evidence_url: String,
    ) {
        requester.require_auth();
        let req = VerificationRequest {
            asset_id,
            requester,
            evidence_url,
            submitted_at: env.ledger().timestamp(),
            status: VerifStatus::Pending,
            reviewed_by: None,
            reviewed_at: None,
            notes: String::from_str(&env, ""),
        };
        env.storage()
            .instance()
            .set(&VerifDataKey::Request(asset_id), &req);
    }

    /// Verifier approves or rejects a pending request.
    pub fn review_request(
        env: Env,
        verifier: Address,
        asset_id: u64,
        approve: bool,
        notes: String,
    ) {
        verifier.require_auth();
        assert!(
            env.storage()
                .instance()
                .get::<_, bool>(&VerifDataKey::Verifier(verifier.clone()))
                .unwrap_or(false),
            "caller is not a verifier"
        );
        let mut req: VerificationRequest = env
            .storage()
            .instance()
            .get(&VerifDataKey::Request(asset_id))
            .expect("request not found");
        assert_eq!(req.status, VerifStatus::Pending, "request already reviewed");
        req.status = if approve { VerifStatus::Approved } else { VerifStatus::Rejected };
        req.reviewed_by = Some(verifier.clone());
        req.reviewed_at = Some(env.ledger().timestamp());
        req.notes = notes;
        env.storage()
            .instance()
            .set(&VerifDataKey::Request(asset_id), &req);
        if approve {
            env.storage()
                .instance()
                .set(&VerifDataKey::Verified(asset_id), &true);
        }
    }

    /// Returns true if an asset is verified.
    pub fn is_verified(env: Env, asset_id: u64) -> bool {
        env.storage()
            .instance()
            .get(&VerifDataKey::Verified(asset_id))
            .unwrap_or(false)
    }

    /// Returns the verification request for an asset, if any.
    pub fn get_request(env: Env, asset_id: u64) -> Option<VerificationRequest> {
        env.storage().instance().get(&VerifDataKey::Request(asset_id))
    }

    /// Returns true if the address is a registered verifier.
    pub fn is_verifier(env: Env, addr: Address) -> bool {
        env.storage()
            .instance()
            .get::<_, bool>(&VerifDataKey::Verifier(addr))
            .unwrap_or(false)
    }
}