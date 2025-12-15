import {
  getAaveApprovalTx,
  getAaveWithdrawTx,
  getAvailableMarkets,
  getATokens,
  Transaction,
} from '@lit-protocol/vincent-ability-aave';
import { disconnectVincentAbilityClients } from '@lit-protocol/vincent-app-sdk/abilityClient';
import { Hex, parseUnits } from 'viem';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - yargs types exist, but TypeScript has trouble resolving them with bundler moduleResolution
import yargs from 'yargs';

import { chain, publicClient } from '../environment/base';
import { vincentAppId } from '../environment/lit';
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
      description: 'Amount to withdraw',
      required: true,
    })
    .option('asset', {
      alias: 's',
      type: 'string',
      description: 'Asset to withdraw (symbol or address)',
      default: 'USDC',
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

  // Get the aToken address for the asset
  const aTokens = getATokens(chain.id);
  const assetSymbol = argv.asset.toUpperCase();
  const aTokenAddress = aTokens[assetSymbol] as Hex;
  if (!aTokenAddress) {
    throw new Error(
      `aToken for ${assetSymbol} not found in Aave markets for chain ${chain.id}`
    );
  }

  const { ownerKernelAccount, pkpEthAddress, serializedPermissionAccount } =
    await setupZeroDevSmartAccountAndDelegation();

  const decimals = await getERC20Decimals(assetAddress);
  const amount = parseUnits(argv.amount.toString(), decimals);

  // Create transactions: approve aToken + withdraw
  const aaveTransactions: Transaction[] = [];

  aaveTransactions.push(
    getAaveApprovalTx({
      accountAddress: ownerKernelAccount.address,
      amount: amount.toString(),
      assetAddress: aTokenAddress,
      chainId: chain.id,
    })
  );

  aaveTransactions.push(
    getAaveWithdrawTx({
      accountAddress: ownerKernelAccount.address,
      appId: vincentAppId,
      amount: amount.toString(),
      assetAddress,
      chainId: chain.id,
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
