import { disconnectVincentAbilityClients } from '@lit-protocol/vincent-app-sdk/abilityClient';
import { Hex, toHex } from 'viem';

import {
  abilityClient,
  alchemyRpc,
  entryPoint,
  ownerAccount,
  vincentAppId,
} from './environment';
import { generateTransactions } from './utils/generateTransactions';
import { generateZeroDevPermissionAccount } from './utils/generateZeroDevPermissionAccount';
import { setupVincentDelegation } from './utils/setupVincentDelegation';
import { setupZeroDevAccount } from './utils/setupZeroDevAccount';
import { sendPermittedUserOperation } from './utils/sendPermittedUserOperation';
import { transactionsToUserOp } from './utils/transactionsToUserOp';
import { serializeUserOpForVincent } from './utils/serializeUserOpForVincent';
import { setupSmartAccountAndDelegation } from './utils/setupSmartAccountAndDelegation';

async function main() {
  // USER
  const { ownerKernelAccount, pkpEthAddress, serializedPermissionAccount } =
    await setupSmartAccountAndDelegation();

  // CLIENT (APP BACKEND)
  const transactions = await generateTransactions({
    accountAddress: ownerKernelAccount.address,
    permittedAddress: pkpEthAddress,
    serializedPermissionAccount,
  });

  const aaveUserOp = await transactionsToUserOp({
    transactions,
    accountAddress: ownerKernelAccount.address,
    permittedAddress: pkpEthAddress,
    serializedPermissionAccount,
  });

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
    signature: executeResult.result.userOp.signature as Hex,
  };

  // CLIENT (APP BACKEND)
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
