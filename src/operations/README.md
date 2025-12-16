# Individual Aave Operations

These scripts allow you to execute individual Aave protocol operations on your smart account using Vincent abilities. Each operation is isolated, making it easy to understand and test specific functionality without running the entire integration flow.

## Prerequisites

1. **Initial Setup**: Run `npm run kernel-smart-account-integration` at least once to:
   - Test all your env vars
   - Deploy your smart account
   - Set up Vincent PKP delegation
   - Fund your account with USDC (if using `AAVE_USDC_PRIVATE_KEY`)
   - Record the `Account address:` printed at the start

2. **Monitor Your Account**: 
   - Visit [Aave App](https://app.aave.com/)
   - Click the gear icon and enable "Testnet Mode: On"
   - Select "Base Sepolia" as the network
   - Click "Watch wallet" and enter your smart account address
   - You can now monitor your positions and transactions in real-time

## Available Operations

### Supply Assets
Supply assets to Aave lending pools to earn interest:
```bash
npm run operations:supply -- --amount <amount>
```
- Default asset: USDC
- Requires approval transaction before supply

### Withdraw Assets
Withdraw previously supplied assets:
```bash
npm run operations:withdraw -- --amount <amount>
```
- Default asset: USDC
- No approval needed

### Borrow Assets
Borrow assets against your supplied collateral:
```bash
npm run operations:borrow -- --amount <amount> --asset <asset>
```
- Requires collateral already supplied
- Uses variable interest rate by default
- No approval needed for borrowing

### Repay Borrowed Assets
Repay your outstanding loans:
```bash
npm run operations:repay -- --amount <amount> --asset <asset>
```
- Requires approval transaction before repay
- Uses variable rate repayment by default

## Command Options

All commands support the following options:

- `--amount, -a` (required): Amount to transact
- `--asset, -s` (required for borrow/repay): Asset contract address (e.g., `0x4200000000000000000000000000000000000006` for WETH)

## Examples

```bash
# Supply operations (USDC is default)
npm run operations:supply -- --amount 10            # Supply 10 USDC
npm run operations:withdraw -- --amount 5           # Withdraw 5 USDC

# Borrow/Repay operations (must provide asset address)
npm run operations:borrow -- --amount 0.001 --asset 0x4200000000000000000000000000000000000006   # Borrow 0.001 WETH
npm run operations:repay -- --amount 0.001 --asset 0x4200000000000000000000000000000000000006    # Repay 0.001 WETH
```

## Asset Addresses on Base Sepolia

Common asset addresses for Base Sepolia:
- WETH: `0x4200000000000000000000000000000000000006`
- USDC: `0xba50cd2a20f6da35d788639e581bca8d0b5d4d5f`

For other asset addresses, check the [Aave Address Book](https://github.com/bgd-labs/aave-address-book) for Base Sepolia.

## How It Works

Each operation script:
1. Sets up the smart account and Vincent delegation using existing configuration
2. Creates the necessary transaction(s) for the operation
3. Bundles them into a UserOperation
4. Sends to Vincent ability for validation and signing
5. Broadcasts the signed UserOperation to the network

The Vincent ability validates that:
- All interactions are with authorized Aave contracts
- Operations benefit the user (no value extraction)
- Transactions align with Aave's intended use

## Troubleshooting

1. **"Asset not found in available markets"**: Make sure you're using the full contract address (e.g., `0x4200000000000000000000000000000000000006` for WETH).

2. **"Insufficient collateral"**: When borrowing, ensure you have enough collateral supplied. Aave requires overcollateralization.

3. **"Nothing to withdraw"**: You haven't supplied any assets yet, or the amount exceeds your supplied balance.

4. **"Nothing to repay"**: You don't have any outstanding loans for the specified asset.

5. **Transaction fails**: Check that your smart account has enough of the asset you're trying to supply or repay.

## Notes

- All operations use the configuration from your `.env` file
- Gas is sponsored through ZeroDev's paymaster
- Interest rates for borrowing are variable by default (can be modified in the code)
- The scripts automatically fetch token decimals from the contract (no hardcoding)
