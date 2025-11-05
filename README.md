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
│ 2. Setup Vincent Agent PKP for delegated signing to a specific     │
│    Vincent app and its abilities (Aave smart account ability)       │
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
│ 6. Precheck: Decode, simulate, and validate UserOperation          │
│    - Decode the UserOperation calldata                              │
│    - Simulate the transaction on-chain                              │
│    - Validate all interactions are with Aave contracts only         │
│    - Verify operations benefit the user (no value extraction)       │
│ 7. Execute: Same as precheck, plus sign the UserOperation          │
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

- Creates an ECDSA validator using the owner's private key (or generates a random one if not provided)
- Deploys a Kernel v3.3 smart account on Base Sepolia
- Deploys the account with an empty user operation (gas sponsored by ZeroDev paymaster)
- Returns the account address and validator for later use

**Key outputs:**

- `ownerKernelAccount`: The deployed smart account
- `ownerValidator`: Validator that proves ownership
- `accountAddress`: The on-chain address of the smart account

### Step 2: Get or Create Vincent PKP

**File:** `src/setupVincentDelegation.ts`

This step supports two modes of operation:

**Manual Mode (PKP_ETH_ADDRESS provided):**

- Retrieves the PKP (Programmable Key Pair) Ethereum address from environment variables
- This PKP is obtained from the Vincent Dashboard and represents the delegated signer
- The PKP is controlled by Lit Protocol's Vincent ability framework

**Automatic Mode (PKP_ETH_ADDRESS not provided):**

- Authenticates with the owner EOA using Lit Protocol's auth system
- Creates or retrieves a user PKP controlled by the owner EOA
- Mints an agent PKP controlled by the user PKP
- Fetches Vincent app information and abilities from the registry
- Grants all app abilities to the agent PKP via the PKPPermissions contract
- Delegates the app to the agent PKP via the Vincent contract
- Registers PKPs with Lit's payer for free capacity credits (no LIT tokens required)

**Key output:**

- `pkpEthAddress`: The Ethereum address of the Vincent agent PKP that will sign transactions

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
   - When providing `AAVE_USDC_PRIVATE_KEY` with USDC from their Aave's faucet, `deposit` and `withdraw` operations will also be bundled after the approval 
4. Prepares an **unsigned UserOperation** containing:
   - Transaction calldata
   - Gas limits and fee parameters
   - Nonce
   - Paymaster data (for gas sponsorship via ZeroDev)

**File:** `src/aave.ts`

- Provides chain-specific Aave protocol addresses using the official Aave Address Book
- Builds the Aave user operation to use USDC in an Aave lending pool

**Key output:**

- `aaveUserOp`: An unsigned UserOperation ready for signing

### Step 6-7: Vincent Ability Validation and Signing

**File:** `src/smartAccountIntegration.ts` (lines 43-78)

The unsigned UserOperation is sent to the Vincent ability running on Lit Protocol's network:

#### Precheck Phase:

```javascript
await abilityClient.precheck(vincentAbilityParams, vincentDelegationContext);
```

#### Execute Phase:

```javascript
await abilityClient.execute(vincentAbilityParams, vincentDelegationContext);
```

**Both phases perform identical validation:**

1. **Decode**: Parses the UserOperation calldata to understand what transactions will execute
2. **Simulate**: Runs the transaction on-chain (read-only) to see the effects
3. **Validate**:
   - Ensures all contract interactions are with authorized Aave contracts
   - Verifies no value is being extracted from the user
   - Checks that operations align with user's benefit (e.g., depositing, borrowing safely)
   - Validates against the allowlist of Aave protocol addresses

**The only difference:** The `execute` phase also **signs** the UserOperation with the PKP's private key after all validations pass, while `precheck` only validates without signing.

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
- A Vincent App with the Aave smart account ability configured
- Private key for delegatee account of that app (used to interact with Lit Protocol)
- **Optional:** Private key for owner account (auto-generated if not provided)
- **Optional (choose one of two PKP setup approaches):**
  - A Vincent PKP address from Lit Protocol Dashboard (manual setup), OR
  - Lit relay credentials (LIT_RELAY_API_KEY and LIT_PAYER_SECRET_KEY) for automatic PKP creation

## Creating a Vincent App

Before running this POC, you need to create a Vincent app with the appropriate abilities and delegator configuration.

### Step-by-Step Guide:

1. **Learn about Vincent Apps**
   - Read the [Vincent Apps documentation](https://docs.heyvincent.ai/concepts/apps/about) to understand how apps work
   - Familiarize yourself with the concepts of abilities, delegators, and permissions

2. **Create Your App**
   - Visit the [Vincent Dashboard](https://dashboard.heyvincent.ai)
   - Navigate to the Apps section
   - Click "Create New App" or select an existing app

3. **Add the Aave Smart Account Ability**
   - In your app configuration, add the ability:
     - Package: `@lit-protocol/vincent-ability-aave-smart-account`
     - This ability validates and signs UserOperations for Aave protocol interactions
   - Save the ability configuration

4. **Configure Your Delegator Account**
   - Generate a delegator private key (this will be your `DELEGATEE_PRIVATE_KEY`):
     ```bash
     cast wallet new
     ```
   - In the app settings, add the Ethereum address derived from this private key as an authorized delegator
   - This allows your backend service to interact with the Vincent ability on behalf of users

5. **Note Your App ID**
   - Copy the numeric App ID from the dashboard
   - You'll use this as `VINCENT_APP_ID` in your `.env` file

6. **Choose Your PKP Setup Method**
   - **Manual Delegation (Recommended for production):**
     - Log into the dashboard with your owner EOA
     - Delegate your app to create an agent PKP
     - Copy the agent PKP address for `PKP_ETH_ADDRESS`

   - **Automatic Setup (For development):**
     - Contact Lit Protocol to obtain:
       - `LIT_RELAY_API_KEY`
       - `LIT_PAYER_SECRET_KEY`
     - The script will programmatically create the user PKP, agent PKP, and delegation

### Important Notes:

- **Owner Private Key Control**: If you provide or generate an `OWNER_PRIVATE_KEY`, you can use it to log into the Vincent Dashboard to:
  - View and manage your user PKP
  - Control your agent PKP
  - Revoke or modify app delegations
  - Monitor ability execution history

- **VINCENT_APP_ID Requirement**: This variable is only required when using automatic PKP creation (Option B)

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
# Private key that holds some USDC to also test the deposit/withdraw functionality and multicall user operations (optional)
AAVE_USDC_PRIVATE_KEY=0x...

# Private key of the smart account owner (optional - will be auto-generated if not provided)
OWNER_PRIVATE_KEY=0x...

# Vincent App ID (get from Vincent Dashboard at https://dashboard.heyvincent.ai)
VINCENT_APP_ID=

# Private key of the delegatee (used to interact with Lit Protocol)
DELEGATEE_PRIVATE_KEY=0x...

# === PKP Setup (Choose ONE of two approaches) ===
# Option 1: Provide existing PKP address (manual setup via dashboard.heyvincent.ai)
PKP_ETH_ADDRESS=0x...

# Option 2: Automatic PKP creation (required if PKP_ETH_ADDRESS is not provided)
LIT_RELAY_API_KEY=
LIT_PAYER_SECRET_KEY=

# Alchemy RPC URL for Base Sepolia
ALCHEMY_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# ZeroDev bundler RPC URL
ZERODEV_RPC_URL=https://rpc.zerodev.app/api/v2/bundler/YOUR_PROJECT_ID
```

#### Getting the required values:

1. **AAVE_USDC_PRIVATE_KEY** (Optional): Leave empty to only bundle ERC-20 approvals in the user operations, or provide your own:
   - Pick a private key to receive USDC from the Aave faucet
   - Visit the [Aave Faucet](https://faucet.aave.com/)
   - Get USDC from the faucet into your private key

2. **OWNER_PRIVATE_KEY** (Optional): Leave empty to auto-generate, or provide your own:

   ```bash
   cast wallet new
   ```

3. **VINCENT_APP_ID** (Required):
   - Visit the [Vincent Dashboard](https://dashboard.heyvincent.ai)
   - Find your app or create a new one
   - Copy the App ID (numeric value)

4. **DELEGATEE_PRIVATE_KEY** (Required):
   - Generate a new private key using:
     ```bash
     cast wallet new
     ```
   - **Important**: After generating, you must configure this same private key's address in your Vincent App
   - This private key represents the app/service that will execute the ability on behalf of the user

5. **PKP Setup** - Choose one of two approaches:

   **Option A: Manual PKP Setup (Recommended for production)**
   - Visit the [Vincent Dashboard](https://dashboard.heyvincent.ai)
   - Create a user account and authenticate with your EOA
   - Create or select a Vincent app
   - Delegate the app to create an agent PKP
   - Copy the agent PKP address and set it as `PKP_ETH_ADDRESS`
   - Leave `LIT_RELAY_API_KEY` and `LIT_PAYER_SECRET_KEY` empty

   **Option B: Automatic PKP Creation**
   - Leave `PKP_ETH_ADDRESS` empty
   - Set `LIT_RELAY_API_KEY` (contact Lit Protocol team or use test key)
   - Set `LIT_PAYER_SECRET_KEY` (contact Lit Protocol team or use test key)
   - The script will automatically:
     - Create a user PKP authenticated by the owner EOA
     - Mint an agent PKP controlled by the user PKP
     - Grant Vincent abilities to the agent PKP
     - Delegate the app to the agent PKP
     - Return the agent PKP address

6. **ALCHEMY_RPC_URL**:
   - Sign up at [Alchemy](https://www.alchemy.com)
   - Create a new app for Base Sepolia
   - Copy the HTTPS endpoint

7. **ZERODEV_RPC_URL**:
   - Sign up at [ZeroDev](https://zerodev.app)
   - Create a new project
   - Copy the bundler RPC URL

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
         },
       ],
     }),
   ];
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

1. **"Missing env variable"**:
   - Ensure required variables are filled: `VINCENT_APP_ID`, `DELEGATEE_PRIVATE_KEY`, `ALCHEMY_RPC_URL`, `ZERODEV_RPC_URL`
   - For PKP setup, provide either `PKP_ETH_ADDRESS` OR both `LIT_RELAY_API_KEY` and `LIT_PAYER_SECRET_KEY`

2. **"Precheck failed"**:
   - Verify PKP address matches the one from Vincent Dashboard or the one created automatically
   - Ensure the DELEGATEE_PRIVATE_KEY corresponds to an app that has been delegated to the PKP

3. **"User operation failed"**: Check that USDC exists on Base Sepolia in Aave markets

4. **PKP creation fails**:
   - Verify `LIT_RELAY_API_KEY` and `LIT_PAYER_SECRET_KEY` are correct
   - Check that you have a valid Vincent App ID
   - Ensure the app has abilities configured

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
