import { toVincentUserOp } from '@lit-protocol/vincent-ability-aave-smart-account';
import { disconnectVincentAbilityClients } from '@lit-protocol/vincent-app-sdk/abilityClient';
import { Hex, concat } from 'viem';

import { alchemyRpc } from './environment/base';
import { abilityClient } from './environment/lit';
import { entryPoint } from './environment/zerodev';
import { fundAccount } from './utils/fundAccount';
import { generateTransactions } from './utils/generateTransactions';
import { sendPermittedKernelUserOperation } from './utils/sendPermittedKernelUserOperation';
import { setupZeroDevSmartAccountAndDelegation } from './utils/setupZeroDevSmartAccountAndDelegation';
import { transactionsToKernelUserOp } from './utils/transactionsToKernelUserOp';

async function main() {
  // USER
  const { ownerKernelAccount, pkpEthAddress, serializedPermissionAccount } =
    await setupZeroDevSmartAccountAndDelegation();

  // CLIENT (APP BACKEND)
  await fundAccount({
    accountAddress: ownerKernelAccount.address,
  });

  const transactions = await generateTransactions({
    accountAddress: ownerKernelAccount.address,
  });

  const aaveUserOp = await transactionsToKernelUserOp({
    transactions,
    serializedPermissionAccount,
    permittedAddress: pkpEthAddress,
  });

  console.log(
    `Sending user op and serialized session signer to the Lit Signer...`
  );

  const vincentAbilityParams = {
    alchemyRpcUrl: alchemyRpc,
    entryPointAddress: entryPoint.address,
    userOp: toVincentUserOp(aaveUserOp),
  };
  const vincentDelegationContext = {
    delegatorPkpEthAddress: pkpEthAddress,
  };

  const precheckResult = await abilityClient.precheck(
    vincentAbilityParams,
    vincentDelegationContext
  );
  if (!precheckResult.success) {
    throw new Error(`Precheck failed: ${JSON.stringify(precheckResult)}`);
  }

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
    signature: concat(['0xff', executeResult.result.signature as Hex]),
  };

  // CLIENT (APP BACKEND)
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
