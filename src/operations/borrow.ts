import {
  getAaveBorrowTx,
  getAvailableMarkets,
  Transaction,
} from '@lit-protocol/vincent-ability-aave';
import { disconnectVincentAbilityClients } from '@lit-protocol/vincent-app-sdk/abilityClient';
import { Hex, parseUnits } from 'viem';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - yargs types exist, but TypeScript has trouble resolving them with bundler moduleResolution
import yargs from 'yargs';

import { chain, publicClient } from '../environment/base';
import { getKernelUserOperationSignature } from '../utils/getKernelUserOperationSignature';
import { sendPermittedKernelUserOperation } from '../utils/sendPermittedKernelUserOperation';
import { setupZeroDevSmartAccountAndDelegation } from '../utils/setupZeroDevSmartAccountAndDelegation';
import { transactionsToKernelUserOp } from '../utils/transactionsToKernelUserOp';
import { getERC20Decimals } from '../utils/erc20';

async function main() {
  const argv = await yargs(process.argv)
    .option('amount', {
      alias: 'a',
      type: 'number',
      description: 'Amount to borrow',
      required: true,
    })
    .option('asset', {
      alias: 's',
      type: 'string',
      description: 'Asset to borrow (symbol or address)',
      required: true,
    })
    .parse();

  // Get asset address - if user passed a symbol, try to get it from markets
  let assetAddress: Hex = argv.asset as Hex;
  if (!argv.asset.startsWith('0x')) {
    const markets = getAvailableMarkets(chain.id);
    if (markets[argv.asset.toUpperCase()]) {
      assetAddress = markets[argv.asset.toUpperCase()] as Hex;
      console.log(`Using ${argv.asset} address: ${assetAddress}`);
    } else {
      throw new Error(`Asset ${argv.asset} not found in available markets`);
    }
  }

  const { ownerKernelAccount, pkpEthAddress, serializedPermissionAccount } =
    await setupZeroDevSmartAccountAndDelegation();

  const decimals = await getERC20Decimals(assetAddress);
  const amount = parseUnits(argv.amount.toString(), decimals);

  // Create transactions: borrow
  const aaveTransactions: Transaction[] = [];

  console.log(`Borrowing with `)
  console.log(`Asset address: ${assetAddress}`);
  console.log(`Chain ID: ${chain.id}`);
  console.log(`Interest rate mode: 2 (variable rate)`);
  console.log(`Account address: ${ownerKernelAccount.address}`);
  console.log(`Amount: ${amount}`);

  aaveTransactions.push(
    getAaveBorrowTx({
      accountAddress: ownerKernelAccount.address,
      amount: amount.toString(),
      assetAddress,
      chainId: chain.id,
      interestRateMode: 2, // Variable rate
    })
  );

  const aaveUserOp = await transactionsToKernelUserOp({
    serializedPermissionAccount,
    permittedAddress: pkpEthAddress,
    transactions: aaveTransactions,
  });

  const signature = await getKernelUserOperationSignature({
    pkpAddress: pkpEthAddress,
    secondValidatorId: '0xff',
    userOp: aaveUserOp,
  });

  const signedUserOp = { ...aaveUserOp, signature };

  console.log(`Signed user op:`);
  console.dir(signedUserOp, { depth: null });

  const txHash = await sendPermittedKernelUserOperation({
    serializedPermissionAccount,
    permittedAddress: pkpEthAddress,
    signedUserOp,
  });

  await publicClient.waitForTransactionReceipt({
    confirmations: 2,
    hash: txHash,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectVincentAbilityClients();
    console.log('Success! User operation sent and executed successfully.');
    process.exit(0);
  });
