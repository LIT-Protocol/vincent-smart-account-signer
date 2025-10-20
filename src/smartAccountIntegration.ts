import { disconnectVincentAbilityClients } from '@lit-protocol/vincent-app-sdk/abilityClient';
import { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { abilityClient, alchemyRpc, entryPoint } from './environment';
import { generateUserOperation } from './generateUserOperation';
import { generateZeroDevPermissionAccount } from './generateZeroDevPermissionAccount';
import { setupVincentDelegation } from './setupVincentDelegation';
import { setupZeroDevAccount } from './setupZeroDevAccount';
import { sendPermittedUserOperation } from './sendPermittedUserOperation';

const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY as Hex;
const DELEGATEE_PRIVATE_KEY = process.env.DELEGATEE_PRIVATE_KEY as Hex;
if (!OWNER_PRIVATE_KEY || !DELEGATEE_PRIVATE_KEY) {
  throw new Error('Missing env variable');
}

async function main() {
  // USER
  // Set up smart account owner/delegator
  const ownerAccount = privateKeyToAccount(OWNER_PRIVATE_KEY);
  const { ownerValidator, ownerKernelAccount } = await setupZeroDevAccount({ ownerAccount });
  const pkpEthAddress = await setupVincentDelegation({});

  // Generate and serialize the session
  const serializedPermissionAccount = await generateZeroDevPermissionAccount({
    permittedAddress: pkpEthAddress,
    ownerValidator,
  });

  // CLIENT (APP BACKEND)
  const aaveUserOp = await generateUserOperation({
    accountAddress: ownerKernelAccount.address,
    permittedAddress: pkpEthAddress,
    serializedPermissionAccount,
  });

  console.log(`Aave unsigned userOp:`);
  console.dir(aaveUserOp, { depth: null });

  console.log(`Sending user op and serialized session signer to the Lit Signer...`);

  const vincentUserOp = {
    ...aaveUserOp,
    maxFeePerGas: '0x' + aaveUserOp.maxFeePerGas?.toString(16),
    maxPriorityFeePerGas: '0x' + aaveUserOp.maxPriorityFeePerGas?.toString(16),
    nonce: '0x' + aaveUserOp.nonce?.toString(16),
    callGasLimit: '0x' + aaveUserOp.callGasLimit?.toString(16),
    verificationGasLimit: '0x' + aaveUserOp.verificationGasLimit?.toString(16),
    preVerificationGas: '0x' + aaveUserOp.preVerificationGas?.toString(16),
    paymasterVerificationGasLimit: '0x' + aaveUserOp.paymasterVerificationGasLimit?.toString(16),
    paymasterPostOpGasLimit: '0x' + aaveUserOp.paymasterPostOpGasLimit?.toString(16),
  };
  const vincentAbilityParams = {
    entryPointAddress: entryPoint.address,
    rpcUrl: alchemyRpc,
    serializedZeroDevPermissionAccount: serializedPermissionAccount,
    userOp: vincentUserOp,
  };
  const vincentDelegationContext = {
    delegatorPkpEthAddress: pkpEthAddress,
  };

  const precheckResult = await abilityClient.precheck(vincentAbilityParams, vincentDelegationContext);
  if (!precheckResult.success) {
    throw new Error(`Precheck failed: ${JSON.stringify(precheckResult)}`);
  }

  const executeResult = await abilityClient.execute(vincentAbilityParams, vincentDelegationContext);
  if (!executeResult.success) {
    throw new Error(`Execute failed: ${JSON.stringify(executeResult)}`);
  }

  // User op returns signed
  const signedAaveUserOp = {
    ...aaveUserOp,
    signature: executeResult.result.userOp.signature as Hex,
  }

  // CLIENT (APP BACKEND)
  // Send user operation
  await sendPermittedUserOperation({
    permittedAddress: pkpEthAddress,
    serializedPermissionAccount,
    signedUserOp: signedAaveUserOp,
  });

  await disconnectVincentAbilityClients();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
