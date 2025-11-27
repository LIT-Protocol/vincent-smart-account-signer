# Vincent Smart Account & EOA Integration POC

## Overview

This project demonstrates a proof-of-concept integration between **ERC-4337 Smart Accounts** and **EOA transactions**
using **Lit Protocol's Vincent abilities** for secure, scoped delegated signing. It showcases how users can delegate
signing authority to a Vincent ability with strict validation, ensuring that operations are only executed when they meet
specific safety criteria.

The demo supports multiple smart account providers and direct EOA flow:

- **ZeroDev** (Kernel-based smart accounts)
- **Crossmint** (Crossmint-based smart accounts)
- **Safe** (Safe Smart Account)
- **EOA via Vincent PKP** (the Vincent PKP acts as an EOA that signs transactions directly)

The demo specifically focuses on **Aave protocol interactions**, where a Vincent ability validates that all operations
benefit the user and interact only with authorized Aave contracts before signing. This implementation demonstrates how
Vincent can work with multiple smart account providers and even sign raw EOA transactions, providing flexibility in
choosing the infrastructure that best fits your use case.

## Architecture

This POC involves multiple actors and systems working together. There are two execution modes: Smart Account (
UserOperation + bundler) and EOA (raw transaction).

```
┌─────────────────────────────────────────────────────────────────────┐
│                              USER SIDE                              │
├─────────────────────────────────────────────────────────────────────┤
│ 1a. Create Smart Account                                            │
│ 1b. Or use the Vincent Agent PKP as an EOA signer (EOA mode)        │
│ 2. Setup Vincent Agent PKP for delegated signing to a specific      │
│    Vincent app and its abilities (Aave smart account ability)       │
│ 3a. Add Vincent PKP as authorized signer in smart account           │
└────────────────────────┬────────────────────────────────────────────┘
                         │ Account Context / Session Data
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       SERVICE/BACKEND SIDE                          │
├─────────────────────────────────────────────────────────────────────┤
│ 4. Create Aave transaction(s) (e.g., approve/supply/withdraw USDC)  │
│ 5a. (SA) Build unsigned UserOperation with bundled transactions     │
│ 5b. (EOA) Prepare raw transaction request(s)                        │
└────────────────────────┬────────────────────────────────────────────┘
                         │ Unsigned UserOp/Transaction(s)
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    VINCENT ABILITY (Lit Network)                    │
├─────────────────────────────────────────────────────────────────────┤
│ 6. Precheck: Decode, simulate, and validate request                 │
│    - Decode the calldata (UserOp or EOA tx)                         │
│    - Simulate the transaction on-chain                              │
│    - Validate all interactions are with Aave contracts only         │
│    - Verify operations benefit the user (no value extraction)       │
│ 7. Execute: Same as precheck, plus sign (UserOp or EOA tx)          │
└────────────────────────┬────────────────────────────────────────────┘
                         │ Signed UserOp/Transaction(s)
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       SERVICE/BACKEND SIDE                          │
├─────────────────────────────────────────────────────────────────────┤
│ 8a. (SA) Broadcast signed UserOperation via bundler                 │
│ 8b. (EOA) Broadcast signed transaction(s) to the network            │
│ 9. Wait for transaction confirmation                                │
└─────────────────────────────────────────────────────────────────────┘
```

## Flow Breakdown

The flow below showcases **ZeroDev (Kernel)**, **Crossmint**, and **Safe** smart accounts, and also supports an **EOA mode**
using the Vincent PKP as the signer. Choose the path that best fits your use case.

### Step 1: Setup Smart Account

#### Option A: ZeroDev (Kernel) Smart Account

**Files:**

- `src/utils/setupZeroDevAccount.ts`
- `src/kernelSmartAccountIntegration.ts`

- Creates an ECDSA validator using the owner's private key (or generates a random one if not provided)
- Deploys a Kernel v3.3 smart account on Base Sepolia
- Deploys the account with an empty user operation (gas sponsored by ZeroDev paymaster)
- Returns the account address and validator for later use

**Key outputs:**

- `ownerKernelAccount`: The deployed smart account
- `ownerValidator`: Validator that proves ownership
- `accountAddress`: The on-chain address of the smart account

#### Option B: Crossmint Smart Account

**Files:**

- `src/utils/setupCrossmintAccount.ts`
- `src/crossmintSmartAccountIntegration.ts`

- Creates a Crossmint wallet using the Crossmint SDK
- Initializes the wallet with the owner's credentials
- Returns the wallet instance for transaction signing
- Leverages Crossmint's infrastructure for account abstraction

**Key outputs:**

- `wallet`: The Crossmint wallet instance
- `accountAddress`: The on-chain address of the smart account

#### Option C: Safe Smart Account

**Files:**

- `src/utils/setupSafeAccount.ts`
- `src/safeSmartAccountIntegration.ts`

- Deploys a Safe Smart Account (v1.4.1)
- Adds the Vincent PKP as another owner with threshold 1
- This allows the Vincent PKP to sign UserOperations directly for the Safe while keeping the owner EOA as signer

**Key outputs:**

- `safeAccount`: The deployed Safe account
- `accountAddress`: The on-chain address of the smart account

#### Option D: EOA using Vincent PKP as the signer

**Files:**

- `src/eoaIntegration.ts`

- Uses the delegated Vincent PKP as an EOA to sign raw transactions
- Optionally funds the PKP address with native gas and USDC for Aave operations using `FUNDS_PROVIDER_PRIVATE_KEY`
- Generates Aave transactions (approve/supply/withdraw) based on current balance
- Sends the transaction details to the Vincent ability for validation and EOA signing
- Broadcasts the signed raw transaction(s) directly to the network (no bundler)

**Key outputs:**

- `txHash`: The on-chain transaction hash for each broadcasted transaction

### Step 2: Get or Create Vincent PKP

**File:** `src/utils/setupVincentDelegation.ts`

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

### Step 3: Configure PKP Permissions over Smart Account (SA mode only)

**File:** `src/utils/generateZeroDevPermissionAccount.ts`

- Creates an "empty account" for the Vincent PKP address (address without actual signing capability)
- Wraps this empty account in a permission validator
- Sets up a sudo policy (unrestricted for this POC - production should use strict policies)
- Creates a permission-enabled kernel account
- **Serializes** the entire account configuration into a portable string

**Why serialize?**
The serialized account contains all the cryptographic permissions and policies. It can be sent to the backend service,
which can then reconstruct the account context without needing the owner's private key.

**Key output:**

- `serializedPermissionAccount`: A string containing all permission data

### Step 4-5 (SA mode): Generate Aave User Operation

**File:** `src/utils/generateTransactions.ts`

The backend service receives the serialized permission account and:

1. Deserializes the permission account using the Vincent empty account
2. Builds an Aave transaction (in this case, an ERC20 approval):
   - Gets USDC token address for the chain (from Aave Address Book)
   - Gets Aave Pool address
   - Encodes an `approve(spender, amount)` call
   - If the account already holds USDC, `supply` and `withdraw` operations will also be bundled after the approval
3. Prepares an **unsigned UserOperation** containing:
   - Transaction calldata
   - Gas limits and fee parameters
   - Nonce
   - Paymaster data (for gas sponsorship via ZeroDev)

**File:** `src/aave.ts`

- Provides chain-specific Aave protocol addresses using the official Aave Address Book
- Builds the Aave user operation to use USDC in an Aave lending pool

**Key output:**

- `aaveUserOp`: An unsigned UserOperation ready for signing

### Step 4-5 (EOA mode): Generate Aave Transactions

**File:** `src/utils/generateTransactions.ts`

In EOA mode, we build an array of individual Aave transactions for the PKP EOA:

1. Detects USDC token address for the chain (from the Aave Address Book)
2. Reads PKP EOA USDC balance
3. Always prepares an `approve(spender, amount)` call for Aave's pool
4. If balance > 0, also prepares `supply` and a partial `withdraw`

**Key output:**

- `transactions`: An array of raw transaction requests ready for validation/signing

### Step 6-7: Vincent Ability Validation and Signing

In both modes, the request is sent to the Vincent ability running on Lit Protocol's network.

**Files:**

- SA (Kernel): `src/kernelSmartAccountIntegration.ts`
- SA (Crossmint): `src/crossmintSmartAccountIntegration.ts`
- SA (Safe): `src/safeSmartAccountIntegration.ts`
- EOA: `src/eoaIntegration.ts`

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

**The only difference:** The `execute` phase also **signs** the request with the PKP after all validations pass, while
`precheck` only validates without signing.
In SA mode (passing a user operation) `execute` returns a UserOp signature using the standard UserOp signing method `getUserOperationHash` or a custom EIP-712 signature based on the user operation; in EOA mode it returns a standard transaction signature.

**Key package:** `@lit-protocol/vincent-ability-aave-smart-account`
This package contains the bundled Vincent ability code that runs inside Lit Protocol's Trusted Execution Environment (TEE) using its unmutable code.

**Key output:**

- SA mode: `signature` for the UserOperation
- EOA mode: `signature` for the raw transaction

**Signing Methods Supported:**

The ability now supports multiple signing methods depending on the account type:

1.  **Standard UserOp Signing** (Kernel, Crossmint):
    - Signs the `getUserOperationHash` of the UserOp.
2.  **EIP-712 Signing** (Safe):
    - Signs an EIP-712 message derived from the UserOp.
    - Used when passing `safe4337ModuleAddress` and `eip712Params` in the ability parameters.
3.  **EOA Signing** (Vincent PKP):
    - Signs a raw transaction hash.

### Step 8-9: Broadcast Transaction

SA (Kernel):

**File:** `src/utils/sendPermittedKernelUserOperation.ts`

1. Deserializes the permission account
2. Creates a Kernel client
3. Sends the signed UserOperation to the bundler
4. Waits for the UserOperation to be included in a block
5. Returns the transaction hash

Crossmint:

**File:** `src/utils/sendPermittedCrossmintUserOperation.ts`

Performs the equivalent bundling and broadcast for Crossmint accounts.

Safe:

**File:** `src/utils/sendPermittedSafeUserOperation.ts`

1. Adds the signature to the UserOperation
2. Broadcasts via Pimlico bundler

EOA:

**File:** `src/eoaIntegration.ts`

1. Receives the `signature` from the Vincent ability
2. Serializes the transaction using `viem` and the returned signature
3. Broadcasts via `publicClient.sendRawTransaction`
4. Waits for the transaction receipt
5. Prints the transaction hash

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- **Smart Account Provider** (choose the one you want to use):
  - **ZeroDev**: A ZeroDev project (for Kernel accounts, bundler and paymaster)
  - **Crossmint**: A Crossmint API key (for Crossmint smart accounts)
  - **Safe**: Pimlico API key (for Safe accounts, bundler and paymaster)
- An Alchemy account (for RPC access and operations simulation)
- A Vincent App with the Aave smart account ability configured
- Private key for delegatee account of that app (used to interact with Lit Protocol)
- **Optional:** Private key for owner account (auto-generated if not provided)
- **Optional:** A funding wallet with Base Sepolia USDC (to also do supply and withdraw operations) and native tokens (only needed to top up the PKP EOA)
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
   - **Manual Delegation:**
     - Log into the dashboard with your owner EOA
     - Delegate your app to create an agent PKP
     - Copy the agent PKP address for `PKP_ETH_ADDRESS`

   - **Automatic Setup:**
     - Contact Lit Protocol to obtain:
       - `LIT_RELAY_API_KEY`
       - `LIT_PAYER_SECRET_KEY`
     - The script will programmatically create the user PKP, agent PKP, and delegation

### Important Notes:

- **Owner Private Key Control**: If you provide or generate an `OWNER_PRIVATE_KEY`, you can use it to log into the
  Vincent Dashboard to:
  - View and manage your user PKP
  - Control your agent PKP
  - Revoke or modify app delegations

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
# Wallet used to optionally fund accounts with Aave USDC and native gas (optional)
FUNDS_PROVIDER_PRIVATE_KEY=0x...

# Private key of the smart account owner (optional - will be auto-generated if not provided)
OWNER_PRIVATE_KEY=0x...

# Passing these will setup the user and agent PKPs and delegation (if PKP_ETH_ADDRESS is not provided)
LIT_PAYER_SECRET_KEY=
LIT_RELAY_API_KEY=

# Or can be done manually in dashboard.heyvincent.ai and then bringing the address here
PKP_ETH_ADDRESS=0x...

# Private key of the delegatee (used to interact with Lit Protocol)
DELEGATEE_PRIVATE_KEY=0x...

# Vincent App ID (get from Vincent Dashboard at https://dashboard.heyvincent.ai)
VINCENT_APP_ID=

# Alchemy RPC URL for Base Sepolia. Always required, used for operations simulation inside Vincent Ability
ALCHEMY_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Crossmint API Key. Required only for Crossmint integration
CROSSMINT_API_KEY=

# Pimlico RPC URL for Base Sepolia. Required only for Safe integration
PIMLICO_RPC_URL=https://base-sepolia.pimlico.io/v1/YOUR_API_KEY

# ZeroDev bundler RPC URL. Required only for ZeroDev/Kernel integration
ZERODEV_RPC_URL=https://rpc.zerodev.app/api/v2/bundler/YOUR_PROJECT_ID
```

#### Getting the required values:

1. **FUNDS_PROVIDER_PRIVATE_KEY** (Optional): Used to fund the smart account or PKP EOA with USDC and native gas so that
   full flows (approve + supply + withdraw) can run.
   - Fund this wallet with Base Sepolia USDC used by
     Aave: https://app.aave.com/reserve-overview/?underlyingAsset=0xba50cd2a20f6da35d788639e581bca8d0b5d4d5f&marketName=proto_base_sepolia_v3
     Note: The faucet at https://app.aave.com/faucet links to a different USDC that is NOT used by Aave Base Sepolia
     pools.
   - Fund it with some Base Sepolia native tokens as well (e.g., via https://faucet.quicknode.com/base/sepolia) —
     needed especially for EOA mode.

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

   **Option A: Manual PKP Setup**
   - Visit the [Vincent Dashboard](https://dashboard.heyvincent.ai)
   - Create a user account and authenticate with your EOA
   - Create or select a Vincent app
   - Delegate the app to create an agent PKP
   - Copy the agent PKP address and set it as `PKP_ETH_ADDRESS`
   - Leave `LIT_RELAY_API_KEY` and `LIT_PAYER_SECRET_KEY` empty

   **Option B: Automatic PKP Creation**
   - Leave `PKP_ETH_ADDRESS` empty
   - Set `LIT_RELAY_API_KEY` (contact Lit Protocol team)
   - Set `LIT_PAYER_SECRET_KEY` (contact Lit Protocol team)
   - The script will automatically:
     - Create a user PKP authenticated by the owner EOA
     - Mint an agent PKP controlled by the user PKP
     - Grant Vincent abilities to the agent PKP
     - Delegate the app to the agent PKP
     - Return the agent PKP address

6. **Smart Account Provider Setup** - Configure based on your chosen provider(s):

   **For ZeroDev (Kernel) Integration:**
   - **ZERODEV_RPC_URL**:
     - Sign up at [ZeroDev](https://zerodev.app)
     - Create a new project
     - Copy the bundler RPC URL

   **For Crossmint Integration:**
   - **CROSSMINT_API_KEY**:
     - Sign up at [Crossmint](https://www.crossmint.com/)
     - Navigate to the API section in your dashboard
     - Generate an API key for your project

   **For Safe Integration:**
   - **PIMLICO_RPC_URL**:
     - Sign up at [Pimlico](https://dashboard.pimlico.io/)
     - Navigate to the API section in your dashboard
     - Generate an API key for your project
     - Copy the bundler RPC URL

7. **ALCHEMY_RPC_URL** (Required for operations simulation in Vincent Ability):
   - Sign up at [Alchemy](https://www.alchemy.com)
   - Create a new app for Base Sepolia
   - Copy the HTTPS endpoint

## Running the Project

### Smart Account Integration (Kernel / ZeroDev)

Runs the full flow with a Kernel smart account (ZeroDev):

```bash
npm run kernel-smart-account-integration
```

This demonstrates smart account setup, PKP delegation, Aave operations, Vincent ability validation + signing of a
UserOperation, and bundling.

### Smart Account Integration (Crossmint)

```bash
npm run crossmint-smart-account-integration
```

### Smart Account Integration (Safe)

```bash
npm run safe-smart-account-integration
```

### EOA Integration (Vincent PKP as EOA)

Runs the full EOA flow where the Vincent PKP signs raw transactions directly:

```bash
npm run eoa-integration
```

This will:

- Ensure the PKP EOA has the necessary funds (optional helper)
- Build Aave transactions
- Send them to the Vincent ability for validation and signing
- Broadcast signed transactions on-chain

### Individual Operations

For testing specific Aave operations in isolation with a smart account, see
the [operations README](src/operations/README.md). These scripts
allow you to:

- Supply assets to Aave lending pools
- Withdraw supplied assets
- Borrow assets against collateral
- Repay borrowed assets

Each operation script demonstrates how to execute a single transaction type through the Vincent ability, making it
easier to understand and test specific functionality without running the entire integration flow.

Example commands:

```bash
# Supply/withdraw operations (USDC is default)
npm run operations:supply -- --amount 10        # Supply 10 USDC
npm run operations:withdraw -- --amount 5       # Withdraw 5 USDC

# Borrow/repay operations (must specify asset address)
npm run operations:borrow -- --amount 0.001 --asset 0x4200000000000000000000000000000000000006  # Borrow 0.001 WETH
npm run operations:repay -- --amount 0.001 --asset 0x4200000000000000000000000000000000000006   # Repay 0.001 WETH
```

### Expected Output

You should see output similar to (Kernel / ZeroDev):

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

EOA mode example output:

```
📝 Processing transaction 1/3
   → To: 0x...
   🚀 Broadcasting transaction...
   ✅ Transaction confirmed at hash 0x...

🎉 Success! All transactions signed and broadcasted for the Vincent PKP.
```

## Technical Details

### Smart Account Stack

This project supports two smart account providers:

#### ZeroDev (Kernel) Stack

- **ZeroDev SDK** (`@zerodev/sdk`): Provides Kernel account implementation (ERC-4337 compatible)
- **ZeroDev Permissions** (`@zerodev/permissions`): Enables session keys and policy-based access control
- **Kernel Version**: v3.3
- **EntryPoint**: v0.7 (latest ERC-4337 standard)

#### Crossmint Stack

- **Crossmint Wallets SDK** (`@crossmint/wallets-sdk`): Provides Crossmint wallet implementation
- **Account Abstraction**: Crossmint-managed smart wallet infrastructure
- **Integrated Services**: Built-in support for custodial and non-custodial wallet experiences

#### Safe Stack

- **Permissionless.js**: Used for Safe account creation and UserOp generation
- **Safe Smart Account**: v1.4.1
- **Pimlico**: Bundler and Paymaster provider

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

### Session Key Security (SA mode)

The session key approach provides:

- **Scoped permissions**: The PKP can only sign for this specific account
- **Policy enforcement**: Vincent ability enforces strict validation rules
- **Auditability**: All operations are transparent and verifiable on-chain
- **Revocability**: Session can be revoked by the owner at any time

## Project Structure

```
src/
├── crossmintSmartAccountIntegration.ts   # Crossmint integration example
├── eoaIntegration.ts                     # EOA flow: PKP signs raw txs and broadcasts
├── kernelSmartAccountIntegration.ts      # ZeroDev Kernel integration example
├── safeSmartAccountIntegration.ts        # Safe integration example
├── environment/                          # Environment configuration modules
│   ├── base.ts                          # Base configuration
│   ├── crossmint.ts                     # Crossmint-specific config
│   ├── lit.ts                           # Lit Protocol config
│   ├── zerodev.ts                       # ZeroDev config
│   └── safe.ts                          # Safe config
├── operations/                          # Individual operation examples
│   ├── README.md                        # Guide for running individual operations
│   ├── supply.ts                        # Supply assets to Aave
│   ├── withdraw.ts                      # Withdraw assets from Aave
│   ├── borrow.ts                        # Borrow assets from Aave
│   └── repay.ts                         # Repay borrowed assets
└── utils/                               # Utility functions
    ├── setupZeroDevAccount.ts           # Creates and deploys Kernel smart account
    ├── setupCrossmintAccount.ts         # Creates Crossmint smart wallet
    ├── setupVincentDelegation.ts        # Gets Vincent PKP address
    ├── setupZeroDevSmartAccountAndDelegation.ts   # ZeroDev combined setup
    ├── setupCrossmintSmartAccountAndDelegation.ts # Crossmint combined setup
    ├── setupSafeSmartAccountAndDelegation.ts      # Safe combined setup
    ├── setupSafeAccount.ts                        # Deploys Safe account
    ├── generateZeroDevPermissionAccount.ts        # Creates session key for Kernel
    ├── transactionsToKernelUserOp.ts    # Builds UserOp for Kernel accounts
    ├── transactionsToCrossmintUserOp.ts # Builds UserOp for Crossmint accounts
    ├── transactionsToSafeUserOp.ts      # Builds UserOp for Safe accounts
    ├── sendPermittedKernelUserOperation.ts        # Broadcasts signed Kernel UserOp
    ├── sendPermittedCrossmintUserOperation.ts     # Broadcasts signed Crossmint UserOp
    ├── sendPermittedSafeUserOperation.ts          # Broadcasts signed Safe UserOp
    ├── generateTransactions.ts          # Builds Aave transactions
    ├── erc20.ts                         # ERC20 ABI and utilities
    ├── fundAccount.ts                   # Optional helper to fund accounts/PKP with USDC and native
    └── types/                           # TypeScript type definitions
```

## Security Considerations

### Current POC Limitations

1. **Sudo Policy**: The current implementation uses `toSudoPolicy({})` which grants unrestricted permissions. \*
   \*Production implementations should use strict policy definitions\*\* limiting:
   - Allowed contract addresses
   - Allowed function selectors
   - Value limits
   - Time windows

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
- **This approach**: Backend receives delegated, scoped signing authority through a trustless validator for any type of
  account (EOA or Smart Account).

### Benefits:

1. **Security**: User's keys never leave their control
2. **Transparency**: All validation logic is auditable in the Vincent ability
3. **Flexibility**: Backend can execute transactions on user's behalf without custody
4. **Compliance**: No key custody reduces regulatory complexity
5. **UX**: Seamless user experience without constant wallet interactions

## Troubleshooting

### Common Issues

1. **"Missing env variable"**:
   - Ensure required variables are filled: `VINCENT_APP_ID`, `DELEGATEE_PRIVATE_KEY`, `ALCHEMY_RPC_URL`
   - For ZeroDev/Kernel: also set `ZERODEV_RPC_URL`
   - For Crossmint: also set `CROSSMINT_API_KEY`
   - For Safe: also set `PIMLICO_RPC_URL`
   - For PKP setup, provide either `PKP_ETH_ADDRESS` OR both `LIT_RELAY_API_KEY` and `LIT_PAYER_SECRET_KEY`

2. **"Precheck failed"**:
   - Verify PKP address matches the one from Vincent Dashboard or the one created automatically
   - Ensure the DELEGATEE_PRIVATE_KEY corresponds to an app that has been delegated to the PKP

3. **"User operation failed"**: Check that USDC exists on Base Sepolia in Aave markets

4. **EOA: insufficient funds for gas**:
   - Ensure the PKP EOA has Base Sepolia native tokens for gas. You can set `FUNDS_PROVIDER_PRIVATE_KEY` to auto-fund a
     small amount, or use a faucet: https://faucet.quicknode.com/base/sepolia

5. **EOA: ability did not return the transaction signature**:
   - Ensure you’re on the branch/version where the Vincent Aave ability supports EOA signing.

6. **PKP creation fails**:
   - Verify `LIT_RELAY_API_KEY` and `LIT_PAYER_SECRET_KEY` are correct
   - Check that you have a valid Vincent App ID
   - Ensure the app has abilities configured

### Debug Mode

For more detailed logs, you can modify the scripts to add additional logging or use:

```bash
DEBUG=* npm run kernel-smart-account-integration
DEBUG=* npm run crossmint-smart-account-integration
DEBUG=* npm run safe-smart-account-integration
DEBUG=* npm run eoa-integration
```

## Next Steps

To build on this POC:

1. Implement strict policies in `generateZeroDevPermissionAccount.ts`
2. Create a web interface for user consent and delegation management
3. Build a backend service to automate UserOperation or transactions generation
4. Add support for multiple DeFi protocols beyond Aave
5. Implement session expiration and renewal flows
6. Add monitoring and alerting for Vincent ability executions

## Resources

- [ZeroDev Documentation](https://docs.zerodev.app/)
- [Crossmint Documentation](https://docs.crossmint.com/)
- [Lit Protocol Documentation](https://developer.litprotocol.com/)
- [Vincent Abilities Guide](https://docs.heyvincent.ai/concepts/abilities/about)
- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)
- [Aave V3 Documentation](https://docs.aave.com/developers/getting-started/readme)
