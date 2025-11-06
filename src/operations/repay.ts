import { disconnectVincentAbilityClients } from '@lit-protocol/vincent-app-sdk/abilityClient';
import { Hex, parseUnits } from 'viem';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - yargs types exist but TypeScript has trouble resolving them with bundler moduleResolution
import yargs from 'yargs';

import { chain, alchemyRpc, entryPoint, abilityClient } from '../environment';
import { sendPermittedUserOperation } from '../utils/sendPermittedUserOperation';
import { setupSmartAccountAndDelegation } from '../utils/setupSmartAccountAndDelegation';
import { transactionsToUserOp } from '../utils/transactionsToUserOp';
import { serializeUserOpForVincent } from '../utils/serializeUserOpForVincent';
import {
  getAaveApprovalTx,
  getAaveRepayTx,
  getAvailableMarkets,
} from '../aave';

async function main() {
  const argv = yargs(process.argv)
    .option('amount', {
      alias: 'a',
      type: 'number',
      description: 'Amount to repay',
      required: true,
    })
    .option('asset', {
      alias: 's',
      type: 'string',
      description: 'Asset address to repay',
      required: true,
    })
    .parse();

  // get asset address - if user passed a symbol, try to get it from markets
  let assetAddress = argv.asset;
  
  // Check if it's a symbol (doesn't start with 0x)
  if (!assetAddress.startsWith('0x')) {
    const markets = getAvailableMarkets(chain.id);
    if (markets[assetAddress.toUpperCase()]) {
      assetAddress = markets[assetAddress.toUpperCase()];
      console.log(`Using ${argv.asset} address: ${assetAddress}`);
    } else {
      throw new Error(`Asset ${assetAddress} not found in available markets`);
    }
  }

  // user setup and delegation
  const { ownerKernelAccount, pkpEthAddress, serializedPermissionAccount } =
    await setupSmartAccountAndDelegation();

  // Parse amount based on asset decimals (assuming 6 for USDC, 18 for most others)
  // In production, you'd want to fetch the actual decimals from the token contract
  const decimals = argv.asset.toUpperCase() === 'USDC' ? 6 : 18;
  const amount = parseUnits(argv.amount.toString(), decimals);

  // Create transactions to be bundled. For repay, we need to approve the asset and then call repay().
  const aaveTransactions = [];

  const aaveApprovalTx = await getAaveApprovalTx({
    accountAddress: ownerKernelAccount.address,
    amount: amount.toString(),
    assetAddress: assetAddress,
    chainId: chain.id,
  });
  aaveTransactions.push(aaveApprovalTx);

  const aaveRepayTx = await getAaveRepayTx({
    accountAddress: ownerKernelAccount.address,
    amount: amount.toString(),
    assetAddress: assetAddress,
    chainId: chain.id,
  });
  aaveTransactions.push(aaveRepayTx);

  // convert the transactions array to a proper zerodev user op
  const aaveUserOp = await transactionsToUserOp({
    transactions: aaveTransactions,
    accountAddress: ownerKernelAccount.address,
    permittedAddress: pkpEthAddress,
    serializedPermissionAccount,
  });

  // send the user op to the lit signer. this is the vincent aave smart account ability.
  console.log(
    `Sending user op and serialized session signer to the Lit Signer...`
  );

  const vincentAbilityParams = {
    alchemyRpcUrl: alchemyRpc,
    entryPointAddress: entryPoint.address,
    serializedZeroDevPermissionAccount: serializedPermissionAccount,
    userOp: serializeUserOpForVincent(aaveUserOp),
  };
  const vincentDelegationContext = {
    delegatorPkpEthAddress: pkpEthAddress,
  };

  // precheck is run on the client side. if it fails, you can stop, and you don't have to pay Lit to attempt to sign the user op.
  const precheckResult = await abilityClient.precheck(
    vincentAbilityParams,
    vincentDelegationContext
  );
  if (!precheckResult.success) {
    throw new Error(`Precheck failed: ${JSON.stringify(precheckResult)}`);
  }

  // execute is run on the Lit Nodes as a lit action. it actually signs the user op with the PKP.
  const executeResult = await abilityClient.execute(
    vincentAbilityParams,
    vincentDelegationContext
  );
  if (!executeResult.success) {
    throw new Error(`Execute failed: ${JSON.stringify(executeResult)}`);
  }

  // User op returns signed
  const signedAaveUserOp = {
    ...aaveUserOp,
    signature: executeResult.result.userOp.signature as Hex,
  };

  // Send user operation
  await sendPermittedUserOperation({
    permittedAddress: pkpEthAddress,
    serializedPermissionAccount,
    signedUserOp: signedAaveUserOp,
  });

  await disconnectVincentAbilityClients();

  console.log('Success! User operation sent and executed successfully.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});