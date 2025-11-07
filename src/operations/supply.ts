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
  getAaveSupplyTx,
  getAvailableMarkets,
} from '../aave';

async function main() {
  const argv = yargs(process.argv)
    .option('amount', {
      alias: 'a',
      type: 'number',
      description: 'Amount of USDC to supply',
      required: true,
    })
    .parse();

  // get USDC address from aave address book
  const usdcAddress = getAvailableMarkets(chain.id)['USDC'];

  // user setup and delegation
  const { ownerKernelAccount, pkpEthAddress, serializedPermissionAccount } =
    await setupSmartAccountAndDelegation();

  const amount = parseUnits(argv.amount.toString(), 6);

  // Create transactions to be bundled.  for supply, we need to approve the USDC and then call supply().
  const aaveTransactions = [];

  const aaveApprovalTx = await getAaveApprovalTx({
    accountAddress: ownerKernelAccount.address,
    amount: amount.toString(),
    assetAddress: usdcAddress,
    chainId: chain.id,
  });
  aaveTransactions.push(aaveApprovalTx);

  const aaveSupplyTx = await getAaveSupplyTx({
    accountAddress: ownerKernelAccount.address,
    amount: amount.toString(),
    assetAddress: usdcAddress,
    chainId: chain.id,
  });
  aaveTransactions.push(aaveSupplyTx);

  // convert the transactions array to a proper zerodev user op
  const aaveUserOp = await transactionsToUserOp({
    transactions: aaveTransactions,
    accountAddress: ownerKernelAccount.address,
    permittedAddress: pkpEthAddress,
    serializedPermissionAccount,
  });

  // send the user op to the lit signer.  this is the vincent aave smart account ability.
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

  // precheck is run on the client side.  if it fails, you can stop, and you don't have to pay Lit to attempt to sign the user op.
  const precheckResult = await abilityClient.precheck(
    vincentAbilityParams,
    vincentDelegationContext
  );
  if (!precheckResult.success) {
    throw new Error(`Precheck failed: ${JSON.stringify(precheckResult)}`);
  }

  // execute is run on the Lit Nodes as a lit action.  it actually signs the user op with the PKP.
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
