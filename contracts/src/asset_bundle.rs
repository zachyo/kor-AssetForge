use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, String, Vec,
};

// ---------------------------------------------------------------------------
// Storage Keys
// ---------------------------------------------------------------------------

#[derive(Clone)]
#[contracttype]
pub enum BundleDataKey {
    Admin,
    NextBundleId,
    Bundle(u64),
    /// Index of bundles owned by an address
    OwnerBundles(Address),
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub enum BundleStatus {
    Active,
    Listed,
    Sold,
}

#[derive(Clone)]
#[contracttype]
pub struct AssetBundle {
    pub bundle_id: u64,
    pub name: String,
    pub description: String,
    pub creator: Address,
    /// List of asset IDs that form this bundle
    pub asset_ids: Vec<u64>,
    /// Listing price in stroops (0 if not listed)
    pub list_price: i128,
    pub status: BundleStatus,
    pub created_at: u64,
    pub sold_at: Option<u64>,
    pub buyer: Option<Address>,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct AssetBundleContract;

#[contractimpl]
impl AssetBundleContract {
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        env.storage().instance().set(&BundleDataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&BundleDataKey::NextBundleId, &1u64);
    }

    /// Creator assembles a bundle of asset IDs.
    pub fn create_bundle(
        env: Env,
        creator: Address,
        name: String,
        description: String,
        asset_ids: Vec<u64>,
    ) -> u64 {
        creator.require_auth();
        assert!(!asset_ids.is_empty(), "bundle must contain at least one asset");
        let id: u64 = env
            .storage()
            .instance()
            .get(&BundleDataKey::NextBundleId)
            .unwrap_or(1);
        let bundle = AssetBundle {
            bundle_id: id,
            name,
            description,
            creator: creator.clone(),
            asset_ids: asset_ids.clone(),
            list_price: 0,
            status: BundleStatus::Active,
            created_at: env.ledger().timestamp(),
            sold_at: None,
            buyer: None,
        };
        env.storage()
            .instance()
            .set(&BundleDataKey::Bundle(id), &bundle);

        let mut owned: Vec<u64> = env
            .storage()
            .instance()
            .get(&BundleDataKey::OwnerBundles(creator.clone()))
            .unwrap_or(Vec::new(&env));
        owned.push_back(id);
        env.storage()
            .instance()
            .set(&BundleDataKey::OwnerBundles(creator), &owned);

        env.storage()
            .instance()
            .set(&BundleDataKey::NextBundleId, &(id + 1));
        id
    }

    /// Creator lists the bundle for sale at a given price.
    pub fn list_bundle(env: Env, creator: Address, bundle_id: u64, price: i128) {
        creator.require_auth();
        let mut bundle: AssetBundle = env
            .storage()
            .instance()
            .get(&BundleDataKey::Bundle(bundle_id))
            .expect("bundle not found");
        assert_eq!(bundle.creator, creator, "only creator can list");
        assert_eq!(bundle.status, BundleStatus::Active, "bundle not active");
        assert!(price > 0, "price must be positive");
        bundle.list_price = price;
        bundle.status = BundleStatus::Listed;
        env.storage()
            .instance()
            .set(&BundleDataKey::Bundle(bundle_id), &bundle);
    }

    /// Buyer purchases a listed bundle.
    pub fn buy_bundle(
        env: Env,
        buyer: Address,
        bundle_id: u64,
        token: Address,
    ) {
        buyer.require_auth();
        let mut bundle: AssetBundle = env
            .storage()
            .instance()
            .get(&BundleDataKey::Bundle(bundle_id))
            .expect("bundle not found");
        assert_eq!(bundle.status, BundleStatus::Listed, "bundle not listed for sale");

        let token_client = soroban_sdk::token::Client::new(&env, &token);
        token_client.transfer(&buyer, &bundle.creator, &bundle.list_price);

        bundle.status = BundleStatus::Sold;
        bundle.buyer = Some(buyer.clone());
        bundle.sold_at = Some(env.ledger().timestamp());
        env.storage()
            .instance()
            .set(&BundleDataKey::Bundle(bundle_id), &bundle);
    }

    /// Delist a bundle (owner only, only if status is Listed).
    pub fn delist_bundle(env: Env, creator: Address, bundle_id: u64) {
        creator.require_auth();
        let mut bundle: AssetBundle = env
            .storage()
            .instance()
            .get(&BundleDataKey::Bundle(bundle_id))
            .expect("bundle not found");
        assert_eq!(bundle.creator, creator, "only creator can delist");
        assert_eq!(bundle.status, BundleStatus::Listed, "bundle not listed");
        bundle.status = BundleStatus::Active;
        bundle.list_price = 0;
        env.storage()
            .instance()
            .set(&BundleDataKey::Bundle(bundle_id), &bundle);
    }

    pub fn get_bundle(env: Env, bundle_id: u64) -> Option<AssetBundle> {
        env.storage().instance().get(&BundleDataKey::Bundle(bundle_id))
    }

    pub fn get_owner_bundles(env: Env, owner: Address) -> Vec<u64> {
        env.storage()
            .instance()
            .get(&BundleDataKey::OwnerBundles(owner))
            .unwrap_or(Vec::new(&env))
    }
}