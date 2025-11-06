# Individual operation examples

These files let you run individual aave operations on a smart account using Vincent.

First, run `npm run smart-account-integration` to make sure your smart account is set up and funded with some USDC.  Record the `Account address:` printed at the start.  Go to https://app.aave.com/ and then click the little gear icon and set "Testnet Mode: On".  You can then enter the click "watch wallet" and enter the smart account address, so you can view your operation changes in the aave dashboard.

## Examples

Supply $10 USDC: `npm run operations:supply -- --amount 10`
Borrow 0.001 WETH: `npm run operations:borrow -- --amount 0.001 --asset 0x4200000000000000000000000000000000000006`
Repay 0.001 WETH: `npm run operations:repay -- --amount 0.001 --asset 0x4200000000000000000000000000000000000006`
Withdraw $10 USDC: `npm run operations:withdraw -- --amount 10`