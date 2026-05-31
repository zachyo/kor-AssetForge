# Smart Contract Upgrade Mechanism

This document outlines the upgrade flow, governance, and rollback mechanisms implemented in `kor-AssetForge`.

## Upgrade Flow

1. **Propose Upgrade**: The admin proposes a new WASM hash for the contract using `propose_upgrade(new_wasm_hash)`.
2. **Timelock**: The proposal enters a timelock period, where it must wait for a predetermined duration (`timelock_duration`).
3. **Governance Approval**: If a governance contract is configured, it must call `approve_upgrade_governance` on the pending upgrade.
4. **Execution**: After the timelock expires (and governance approves, if required), the admin calls `execute_upgrade`.
   - The upgrade is recorded in history.
   - An `upgrade_executed` event is emitted.
   - The contract's WASM is swapped.

## Rollback Mechanism

The upgradability contract automatically stores the `PreviousWasmHash` during any successful upgrade. 
To roll back a contract:
1. The admin fetches the previous WASM hash using `get_upgrade_record`.
2. The admin proposes a new upgrade pointing to the old WASM hash.
3. The standard upgrade flow (timelock and governance) is followed to execute the rollback.

## Data Migration

A `migrate` function hook is provided. The new version of the contract should implement data layout changes or state modifications within this function. Following the execution of an upgrade, the admin can call `migrate` to finalize state transitions.
