#!/bin/bash

set -e

# Enhanced deployment script for kor-AssetForge contracts
# Features: multi-contract orchestration, configuration-driven, rollback support

DEPLOYMENT_LOG="scripts/deployment.log"
CONTRACT_ADDRESSES_FILE="backend/.contracts"
BACKUP_DIR="scripts/backups"
NETWORK=${1:-"testnet"}
ROLLBACK=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --rollback)
      ROLLBACK=true
      shift
      ;;
    --network)
      NETWORK="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$DEPLOYMENT_LOG"
}

# Error handling
error_exit() {
    log "❌ ERROR: $1"
    if [ "$ROLLBACK" = false ]; then
        log "🔄 Deployment failed. Use --rollback to cleanup"
    fi
    exit 1
}

# Check if stellar CLI is installed
if ! command -v stellar &> /dev/null; then
    error_exit "Stellar CLI not found. Run ./scripts/setup.sh first"
fi

# Check if jq is installed (for JSON parsing)
if ! command -v jq &> /dev/null; then
    error_exit "jq not found. Please install jq for JSON parsing"
fi

# Load deployment configuration
if [ ! -f "scripts/deploy_config.json" ]; then
    error_exit "Deployment configuration file not found: scripts/deploy_config.json"
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Rollback function
rollback_deployment() {
    log "🔄 Rolling back deployment..."
    
    if [ -f "$CONTRACT_ADDRESSES_FILE" ]; then
        while IFS= read -r line; do
            if [[ $line == *=* ]]; then
                contract_name=$(echo "$line" | cut -d'=' -f1)
                contract_id=$(echo "$line" | cut -d'=' -f2)
                
                log "Rolling back $contract_name ($contract_id)"
                # Note: Stellar doesn't have contract destruction, but we can remove from our records
                stellar contract remove "$contract_id" --network "$NETWORK" --source deployer || true
            fi
        done < "$CONTRACT_ADDRESSES_FILE"
        
        mv "$CONTRACT_ADDRESSES_FILE" "$BACKUP_DIR/.contracts.backup.$(date +%s)"
        log "✅ Rollback completed"
    else
        log "No previous deployment found to rollback"
    fi
}

# If rollback flag is set, perform rollback and exit
if [ "$ROLLBACK" = true ]; then
    rollback_deployment
    exit 0
fi

log "🚀 Starting deployment of kor-AssetForge contracts to $NETWORK..."

# Get network configuration
RPC_URL=$(jq -r ".networks.$NETWORK.rpc_url" scripts/deploy_config.json)
NETWORK_PASSPHRASE=$(jq -r ".networks.$NETWORK.network_passphrase" scripts/deploy_config.json)
FRIENDBOT_URL=$(jq -r ".networks.$NETWORK.friendbot_url" scripts/deploy_config.json)

if [ "$RPC_URL" = "null" ]; then
    error_exit "Invalid network: $NETWORK"
fi

# Build contracts
log "Building contracts..."
cd contracts
cargo build --target wasm32-unknown-unknown --release || error_exit "Contract build failed"
cd ..

# Set network
log "Configuring Stellar network: $NETWORK"
stellar network add \
  --global "$NETWORK" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE" || error_exit "Failed to configure network"

# Generate identity if not exists
if ! stellar keys ls | grep -q "deployer"; then
    log "Creating deployer identity..."
    stellar keys generate --global deployer --network "$NETWORK" || error_exit "Failed to generate deployer identity"
fi

# Fund account for testnet
if [ "$NETWORK" = "testnet" ] && [ "$FRIENDBOT_URL" != "null" ]; then
    log "Funding deployer account..."
    stellar keys fund deployer --network "$NETWORK" || error_exit "Failed to fund deployer account"
fi

# Backup existing deployment
if [ -f "$CONTRACT_ADDRESSES_FILE" ]; then
    cp "$CONTRACT_ADDRESSES_FILE" "$BACKUP_DIR/.contracts.backup.$(date +%s)"
    log "Backed up existing deployment"
fi

# Initialize deployment tracking
DEPLOYED_CONTRACTS=""

# Deploy contracts in dependency order
CONTRACT_COUNT=$(jq '.contracts | length' scripts/deploy_config.json)
for ((i=0; i<$CONTRACT_COUNT; i++)); do
    contract_name=$(jq -r ".contracts[$i].name" scripts/deploy_config.json)
    wasm_file=$(jq -r ".contracts[$i].wasm_file" scripts/deploy_config.json)
    init_function=$(jq -r ".contracts[$i].init_function" scripts/deploy_config.json)
    depends_on=$(jq -r ".contracts[$i].depends_on[]?" scripts/deploy_config.json)
    
    log "Deploying $contract_name contract..."
    
    # Check dependencies
    if [ -n "$depends_on" ]; then
        for dep in $depends_on; do
            if ! echo "$DEPLOYED_CONTRACTS" | grep -q "$dep"; then
                error_exit "Dependency $dep not yet deployed for $contract_name"
            fi
        done
    fi
    
    # Deploy contract
    contract_id=$(stellar contract deploy \
      --wasm "contracts/target/wasm32-unknown-unknown/release/$wasm_file" \
      --source deployer \
      --network "$NETWORK" 2>&1 | tail -1) || error_exit "Failed to deploy $contract_name"
    
    log "✅ $contract_name deployed: $contract_id"
    
    # Initialize contract if needed
    init_args=$(jq -r ".contracts[$i].init_args | to_entries | map(\"\(.key)=\(.value)\") | join(\" \")" scripts/deploy_config.json)
    
    # Substitute contract addresses in init args
    for deployed in $DEPLOYED_CONTRACTS; do
        deployed_name=$(echo "$deployed" | cut -d':' -f1)
        deployed_id=$(echo "$deployed" | cut -d':' -f2)
        init_args=$(echo "$init_args" | sed "s/{{$deployed_name}}/$deployed_id/g")
    done
    
    if [ "$init_function" != "null" ] && [ -n "$init_args" ]; then
        log "Initializing $contract_name with: $init_args"
        stellar contract invoke \
          --id "$contract_id" \
          --source deployer \
          --network "$NETWORK" \
          -- "$init_function" $init_args || error_exit "Failed to initialize $contract_name"
    fi
    
    # Save contract address
    echo "${contract_name^^}_CONTRACT_ID=$contract_id" >> "$CONTRACT_ADDRESSES_FILE"
    DEPLOYED_CONTRACTS="$DEPLOYED_CONTRACTS $contract_name:$contract_id"
done

# Generate environment file
log "Generating environment configuration..."
cat > backend/.env.contracts << EOF
# Contract Addresses - Generated on $(date)
$(cat "$CONTRACT_ADDRESSES_FILE")

# Network Configuration
STELLAR_NETWORK=$NETWORK
STELLAR_RPC_URL=$RPC_URL
STELLAR_NETWORK_PASSPHRASE=$NETWORK_PASSPHRASE
EOF

log ""
log "✅ Deployment complete!"
log ""
log "Contract addresses saved to: $CONTRACT_ADDRESSES_FILE"
log "Environment configuration saved to: backend/.env.contracts"
log "Deployment log: $DEPLOYMENT_LOG"
log ""
log "To use these contracts, add to your .env file:"
cat "$CONTRACT_ADDRESSES_FILE"
