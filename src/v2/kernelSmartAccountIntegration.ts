import { toVincentUserOp } from '@lit-protocol/vincent-ability-aave-smart-account';
import { disconnectVincentAbilityClients } from '@lit-protocol/vincent-app-sdk/abilityClient';
import type { CreateKernelAccountReturnType } from '@zerodev/sdk';
import { Hex, concat } from 'viem';

import { alchemyRpc } from '../environment/base';
import { abilityClient } from '../environment/lit';
import { entryPoint } from '../environment/zerodev';
import { fundAccount } from '../utils/fundAccount';
import { generateTransactions } from '../utils/generateTransactions';
import { transactionsToKernelUserOp } from '../utils/transactionsToKernelUserOp';
import { setupVincentDevelopment } from './setupVincentDelegation';

// TODO: ZerodevSmartAccountInfo is not exported from the main package index
// Defining locally until the package exports are updated
interface ZerodevSmartAccountInfo {
  account: CreateKernelAccountReturnType;
  serializedPermissionAccount: string;
}

async function main() {
  // USER - Complete setup using e2e-test-utils
  const result = await setupVincentDevelopment('zerodev');

  if (!result.smartAccount) {
    throw new Error('Smart account was not created');
  }

  const smartAccount = result.smartAccount as ZerodevSmartAccountInfo;
  const ownerKernelAccount = smartAccount.account;
  const serializedPermissionAccount = smartAccount.serializedPermissionAccount;
  const pkpEthAddress = result.agentPkpInfo.ethAddress;

  console.log('\n📋 Using Smart Account:', ownerKernelAccount.address);
  console.log('🔑 PKP Address:', pkpEthAddress);

  // CLIENT (APP BACKEND)
  await fundAccount({
    accountAddress: ownerKernelAccount.address as `0x${string}`,
  });

  const transactions = await generateTransactions({
    accountAddress: ownerKernelAccount.address as `0x${string}`,
  });

  const aaveUserOp = await transactionsToKernelUserOp({
    transactions,
    serializedPermissionAccount,
    permittedAddress: pkpEthAddress as Hex,
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
    delegatorPkpEthAddress: pkpEthAddress as Hex,
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

  if (!executeResult.result?.signature) {
    throw new Error('Execute succeeded but signature is undefined');
  }

  // Add signature to User Operation
  const signedAaveUserOp = {
    ...aaveUserOp,
    // 0xff is the signer id assigned to the Vincent PKP. Hence we have to prepend it to its signature
    signature: concat(['0xff', executeResult.result.signature as Hex]),
  };

  // Send user operation
  const { sendPermittedKernelUserOperation } = await import('../utils/sendPermittedKernelUserOperation');
  await sendPermittedKernelUserOperation({
    permittedAddress: pkpEthAddress as Hex,
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
