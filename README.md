# Vincent Smart Account Integration POC

## Overview

This project demonstrates a proof-of-concept integration between **ZeroDev smart accounts** and **Lit Protocol's Vincent abilities** for secure, scoped delegated signing. It showcases how users can delegate signing authority to a Vincent ability with strict validation, ensuring that operations are only executed when they meet specific safety criteria.

The demo specifically focuses on **Aave protocol interactions**, where a Vincent ability validates that all operations benefit the user and interact only with authorized Aave contracts before signing.

## Architecture

This POC involves multiple actors and systems working together:

```
┌─────────────────────────────────────────────────────────────────────┐
│                              USER SIDE                              │
├─────────────────────────────────────────────────────────────────────┤
│ 1. Create ZeroDev Smart Account                                     │
│ 2. Get Vincent PKP (Programmable Key Pair) from Lit Protocol        │
│ 3. Create Session Key Permission for Vincent PKP                    │
└────────────────────────┬────────────────────────────────────────────┘
                         │ Serialized Session
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       SERVICE/BACKEND SIDE                          │
├─────────────────────────────────────────────────────────────────────┤
│ 4. Create Aave Transaction (e.g., approve USDC for lending pool)   │
│ 5. Build unsigned UserOperation with Aave transaction              │
└────────────────────────┬────────────────────────────────────────────┘
                         │ Unsigned UserOp
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    VINCENT ABILITY (Lit Network)                    │
├─────────────────────────────────────────────────────────────────────┤
│ 6. Precheck: Validate UserOperation structure and permissions      │
│ 7. Execute:                                                         │
│    - Decode the UserOperation calldata                              │
│    - Simulate the transaction on-chain                              │
│    - Validate all interactions are with Aave contracts only         │
│    - Verify operations benefit the user (no value extraction)       │
│    - Sign the UserOperation if all checks pass                      │
└────────────────────────┬────────────────────────────────────────────┘
                         │ Signed UserOp
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       SERVICE/BACKEND SIDE                          │
├─────────────────────────────────────────────────────────────────────┤
│ 8. Broadcast signed UserOperation to network via bundler            │
│ 9. Wait for transaction confirmation                                │
└─────────────────────────────────────────────────────────────────────┘
```

## Flow Breakdown

### Step 1: Setup ZeroDev Smart Account
**File:** `src/setupZeroDevAccount.ts`

- Creates an ECDSA validator using the owner's private key
- Deploys a Kernel v3.3 smart account on Base Sepolia
- Deploys the account with an empty user operation
- Returns the account address and validator for later use

**Key outputs:**
- `ownerKernelAccount`: The deployed smart account
- `ownerValidator`: Validator that proves ownership
- `accountAddress`: The on-chain address of the smart account

### Step 2: Get Vincent PKP Address
**File:** `src/setupVincentDelegation.ts`

- Retrieves the PKP (Programmable Key Pair) Ethereum address from environment variables
- This PKP is obtained from the Vincent Dashboard and represents the delegated signer
- The PKP is controlled by Lit Protocol's Vincent ability framework

**Key output:**
- `pkpEthAddress`: The Ethereum address of the Vincent PKP that will sign transactions

### Step 3: Generate Session Key Permission
**File:** `src/generateZeroDevPermissionAccount.ts`

- Creates an "empty account" for the Vincent PKP address (address without actual signing capability)
- Wraps this empty account in a permission validator
- Sets up a sudo policy (unrestricted for this POC - production should use strict policies)
- Creates a permission-enabled kernel account
- **Serializes** the entire account configuration into a portable string

**Why serialize?**
The serialized account contains all the cryptographic permissions and policies. It can be sent to the backend service, which can then reconstruct the account context without needing the owner's private key.

**Key output:**
- `serializedPermissionAccount`: A string containing all permission data

### Step 4-5: Generate Aave User Operation
**File:** `src/generateUserOperation.ts`

The backend service receives the serialized permission account and:

1. Deserializes the permission account using the Vincent empty account
2. Creates a Kernel client with the permission account
3. Builds an Aave transaction (in this case, an ERC20 approval):
   - Gets USDC token address for the chain (from Aave Address Book)
   - Gets Aave Pool address
   - Encodes an `approve(spender, amount)` call
4. Prepares an **unsigned UserOperation** containing:
   - Transaction calldata
   - Gas limits and fee parameters
   - Nonce
   - Paymaster data (for gas sponsorship via ZeroDev)

**File:** `src/aave.ts`
- Provides chain-specific Aave protocol addresses using the official Aave Address Book
- Builds the approval transaction for USDC to be used with Aave lending pool

**Key output:**
- `aaveUserOp`: An unsigned UserOperation ready for signing

### Step 6-7: Vincent Ability Validation and Signing
**File:** `src/smartAccountIntegration.ts` (lines 43-78)

The unsigned UserOperation is sent to the Vincent ability running on Lit Protocol's network:

#### Precheck Phase:
```javascript
await abilityClient.precheck(vincentAbilityParams, vincentDelegationContext)
```
- Validates the UserOperation structure
- Checks permissions and delegation context
- Verifies the PKP has authority to sign for this account

#### Execute Phase:
```javascript
await abilityClient.execute(vincentAbilityParams, vincentDelegationContext)
```

The Vincent ability performs comprehensive validation:
1. **Decode**: Parses the UserOperation calldata to understand what transactions will execute
2. **Simulate**: Runs the transaction on-chain (read-only) to see the effects
3. **Validate**:
   - Ensures all contract interactions are with authorized Aave contracts
   - Verifies no value is being extracted from the user
   - Checks that operations align with user's benefit (e.g., depositing, borrowing safely)
   - Validates against the allowlist of Aave protocol addresses
4. **Sign**: If all validations pass, signs the UserOperation with the PKP's private key

**Key package:** `@lit-protocol/vincent-ability-aave-smart-account`
This package contains the bundled Vincent ability code that runs inside Lit Protocol's Trusted Execution Environment (TEE).

**Key output:**
- `signedAaveUserOp`: The UserOperation with a valid signature from the Vincent PKP

### Step 8-9: Broadcast Transaction
**File:** `src/sendPermittedUserOperation.ts`

The service receives the signed UserOperation and:

1. Deserializes the permission account again
2. Creates a Kernel client
3. Sends the signed UserOperation to the bundler
4. Waits for the UserOperation to be included in a block
5. Returns the transaction hash

**Key output:**
- Transaction hash confirming on-chain execution

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- A ZeroDev project (for bundler and paymaster)
- An Alchemy account (for RPC access)
- A Vincent PKP from Lit Protocol Dashboard
- Private keys for:
  - Owner account (controls the smart account)
  - Delegatee account (used to interact with Lit Protocol)

## Setup Instructions

### 1. Clone the repository

```bash
cd vincent-smart-account-integration
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and fill in the following values:

```bash
# Private key of the smart account owner
OWNER_PRIVATE_KEY=0x...

# Private key of the delegatee (used to interact with Lit Protocol)
DELEGATEE_PRIVATE_KEY=0x...

# PKP Ethereum address from Vincent Dashboard
PKP_ETH_ADDRESS=0x...

# Alchemy RPC URL for Base Sepolia
ALCHEMY_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# ZeroDev bundler RPC URL
ZERODEV_RPC_URL=https://rpc.zerodev.app/api/v2/bundler/YOUR_PROJECT_ID
```

#### Getting the required values:

1. **OWNER_PRIVATE_KEY & DELEGATEE_PRIVATE_KEY**: Generate using any Ethereum wallet or:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Add `0x` prefix to the output.

2. **PKP_ETH_ADDRESS**:
   - Visit the [Vincent Dashboard](https://vincent.litprotocol.com)
   - Create an account or connect with your EOA
   - Obtain your PKP address from the dashboard

3. **ALCHEMY_RPC_URL**:
   - Sign up at [Alchemy](https://www.alchemy.com)
   - Create a new app for Base Sepolia
   - Copy the HTTPS endpoint

4. **ZERODEV_RPC_URL**:
   - Sign up at [ZeroDev](https://zerodev.app)
   - Create a new project
   - Copy the bundler RPC URL

### 4. Fund the owner account

The owner account needs a small amount of ETH on Base Sepolia to deploy the smart account (gas costs are covered by the paymaster, but deployment requires some ETH initially).

Get testnet ETH from:
- [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)
- [Alchemy Faucet](https://www.alchemy.com/faucets/base-sepolia)

## Running the Project

Execute the main integration script:

```bash
npm run smart-account-integration
```

### Expected Output

You should see output similar to:

```
Account address: 0x... (your smart account address)
Deployment userOp hash: 0x...
{ txHash: '0x...' }

Aave unsigned userOp:
{
  sender: '0x...',
  nonce: 0n,
  callData: '0x...',
  ... (gas parameters)
}

Sending user op and serialized session signer to the Lit Signer...
Broadcasting user op to the network...
UserOp hash: 0x...
{ txHash: '0x...' }
```

## Technical Details

### Smart Account Stack

- **ZeroDev SDK** (`@zerodev/sdk`): Provides Kernel account implementation (ERC-4337 compatible)
- **ZeroDev Permissions** (`@zerodev/permissions`): Enables session keys and policy-based access control
- **Kernel Version**: v3.3
- **EntryPoint**: v0.7 (latest ERC-4337 standard)

### Lit Protocol Integration

- **Vincent Ability**: Custom code running in Lit's decentralized network
- **PKP**: Programmable Key Pair controlled by the Vincent ability
- **Ability Client** (`@lit-protocol/vincent-app-sdk`): Interface to interact with Vincent abilities
- **Network**: Chronicle Yellowstone (Lit's testnet)

### Transaction Validation

The Vincent ability validates:
1. **Contract allowlist**: Only interactions with known Aave contracts
2. **Value extraction**: No ETH or tokens leaving the user's control
3. **Operation safety**: Transactions align with Aave's intended use (lending, borrowing, etc.)
4. **Simulation results**: On-chain simulation must succeed without reverts

### Session Key Security

The session key approach provides:
- **Scoped permissions**: The PKP can only sign for this specific account
- **Policy enforcement**: Vincent ability enforces strict validation rules
- **Auditability**: All operations are transparent and verifiable on-chain
- **Revocability**: Session can be revoked by the owner at any time

## Project Structure

```
src/
├── smartAccountIntegration.ts      # Main orchestration script
├── setupZeroDevAccount.ts          # Creates and deploys smart account
├── setupVincentDelegation.ts       # Gets Vincent PKP address
├── generateZeroDevPermissionAccount.ts  # Creates session key
├── generateUserOperation.ts        # Builds Aave transaction UserOp
├── sendPermittedUserOperation.ts   # Broadcasts signed UserOp
├── aave.ts                        # Aave protocol addresses and helpers
├── erc20.ts                       # ERC20 ABI and utilities
└── environment.ts                 # Configuration and clients
```

## Security Considerations

### Current POC Limitations

1. **Sudo Policy**: The current implementation uses `toSudoPolicy({})` which grants unrestricted permissions. **Production implementations should use strict policy definitions** limiting:
   - Allowed contract addresses
   - Allowed function selectors
   - Value limits
   - Time windows

2. **Manual PKP Setup**: PKP address is manually obtained from the dashboard. Production should automate PKP provisioning.

### Production Recommendations

1. **Implement strict policies**:
   ```typescript
   policies: [
     toCallPolicy({
       permissions: [
         {
           target: AAVE_POOL_ADDRESS,
           selector: APPROVE_SELECTOR,
         }
       ]
     })
   ]
   ```

2. **Add spending limits**: Implement per-transaction and per-day limits
3. **Enable monitoring**: Log all Vincent ability executions
4. **Implement revocation**: Add ability for users to instantly revoke PKP permissions
5. **Multi-sig fallback**: Consider multi-sig recovery mechanisms

## Why This Matters

This POC demonstrates a revolutionary approach to delegated signing:

- **Traditional approach**: Backend holds user private keys (high risk, regulatory burden)
- **This approach**: Backend receives delegated, scoped signing authority through a trustless validator

### Benefits:

1. **Security**: User's keys never leave their control
2. **Transparency**: All validation logic is auditable in the Vincent ability
3. **Flexibility**: Backend can execute transactions on user's behalf without custody
4. **Compliance**: No key custody reduces regulatory complexity
5. **UX**: Seamless user experience without constant wallet interactions

## Troubleshooting

### Common Issues

1. **"Missing env variable"**: Ensure all variables in `.env` are filled
2. **"Insufficient funds"**: Owner account needs Base Sepolia ETH
3. **"Precheck failed"**: Verify PKP address matches the one from Vincent Dashboard
4. **"User operation failed"**: Check that USDC exists on Base Sepolia in Aave markets

### Debug Mode

For more detailed logs, you can modify the scripts to add additional logging or use:

```bash
DEBUG=* npm run smart-account-integration
```

## Next Steps

To build on this POC:

1. Implement strict policies in `generateZeroDevPermissionAccount.ts`
2. Create a web interface for user consent and delegation management
3. Build a backend service to automate UserOperation generation
4. Add support for multiple DeFi protocols beyond Aave
5. Implement session expiration and renewal flows
6. Add monitoring and alerting for Vincent ability executions

## Resources

- [ZeroDev Documentation](https://docs.zerodev.app/)
- [Lit Protocol Documentation](https://developer.litprotocol.com/)
- [Vincent Abilities Guide](https://developer.litprotocol.com/vincent)
- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)
- [Aave V3 Documentation](https://docs.aave.com/developers/getting-started/readme)
