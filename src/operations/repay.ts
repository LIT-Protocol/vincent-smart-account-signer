import { disconnectVincentAbilityClients } from '@lit-protocol/vincent-app-sdk/abilityClient';
import { Hex, parseUnits } from 'viem';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - yargs types exist, but TypeScript has trouble resolving them with bundler moduleResolution
import yargs from 'yargs';

import {
  getAaveApprovalTx,
  getAaveRepayTx,
  getAvailableMarkets,
} from '../aave';
import { chain, alchemyRpc } from '../environment/base';
import { abilityClient } from '../environment/lit';
import { entryPoint } from '../environment/zerodev';
import { sendPermittedKernelUserOperation } from '../utils/sendPermittedKernelUserOperation';
import { setupZeroDevSmartAccountAndDelegation } from '../utils/setupZeroDevSmartAccountAndDelegation';
import { transactionsToKernelUserOp } from '../utils/transactionsToKernelUserOp';
import { getERC20Decimals } from '../utils/erc20';
import { userOp } from '../utils/userOp';

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
    await setupZeroDevSmartAccountAndDelegation();

  // Get decimals from the ERC20 contract
  const decimals = await getERC20Decimals(assetAddress);
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
  const aaveUserOp = await transactionsToKernelUserOp({
    serializedPermissionAccount,
    permittedAddress: pkpEthAddress,
    transactions: aaveTransactions,
  });

  // send the user op to the lit signer. this is the vincent aave smart account ability.
  console.log(
    `Sending user op and serialized session signer to the Lit Signer...`
  );

  const vincentAbilityParams = {
    alchemyRpcUrl: alchemyRpc,
    entryPointAddress: entryPoint.address,
    serializedZeroDevPermissionAccount: serializedPermissionAccount,
    userOp: userOp(aaveUserOp),
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
  await sendPermittedKernelUserOperation({
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
