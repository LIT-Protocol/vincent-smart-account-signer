import { toVincentUserOp, safeEip712Params } from '@lit-protocol/vincent-ability-aave-smart-account';
import type { SmartAccountInfo } from '@lit-protocol/vincent-e2e-test-utils';
import { disconnectVincentAbilityClients } from '@lit-protocol/vincent-app-sdk/abilityClient';
import { Address, Hex, concat, toHex } from 'viem';

import { alchemyRpc } from '../environment/base';
import { abilityClient } from '../environment/lit';
import { entryPoint } from '../environment/safe';
import { fundAccount } from '../utils/fundAccount';
import { generateTransactions } from '../utils/generateTransactions';
import { transactionsToSafeUserOp } from '../utils/transactionsToSafeUserOp';
import { setupVincentDevelopment } from './setupVincentDelegation';
import { executeVincentAbility } from './executeVincentAbility';

async function main() {
  // USER - Complete setup using e2e-test-utils
  const result = await setupVincentDevelopment('safe');

  if (!result.smartAccount) {
    throw new Error('Smart account was not created');
  }

  const smartAccount = result.smartAccount as SmartAccountInfo;
  const safeAccount = smartAccount.account;
  const pkpEthAddress = result.agentPkpInfo.ethAddress;

  console.log('\n📋 Using Safe Account:', safeAccount.address);
  console.log('🔑 PKP Address:', pkpEthAddress);

  // CLIENT (APP BACKEND)
  await fundAccount({
    accountAddress: safeAccount.address as `0x${string}`,
  });

  const transactions = await generateTransactions({
    accountAddress: safeAccount.address as `0x${string}`,
  });

  const aaveUserOp = await transactionsToSafeUserOp({
    transactions,
    safeAddress: safeAccount.address as `0x${string}`,
    permittedAddress: pkpEthAddress as Hex,
  });

  console.log(
    `Sending user op and serialized session signer to the Lit Signer...`
  );

  const validAfter = 0;
  const validUntil = 0;
  const vincentAbilityParams = {
    validAfter,
    validUntil,
    alchemyRpcUrl: alchemyRpc,
    eip712Params: safeEip712Params,
    entryPointAddress: entryPoint.address,
    safe4337ModuleAddress: '0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226' as Address,
    userOp: toVincentUserOp(aaveUserOp),
  };

  const executeResult = await executeVincentAbility({
    abilityClient,
    vincentAbilityParams,
    delegatorPkpEthAddress: pkpEthAddress as Hex,
  });

  // Add signature to User Operation
  const signedAaveUserOp = {
    ...aaveUserOp,
    // Safe signatures have the following shape [validAfter (6 bytes)][validUntil (6 bytes)][sig (ECDSA)][maybe-module]
    signature: concat([toHex(validAfter, { size: 6 }), toHex(validUntil, { size: 6 }), executeResult]),
  };

  console.log(`Signed user op: `);
  console.dir(signedAaveUserOp, { depth: null });

  // Send user operation
  const { sendPermittedSafeUserOperation } = await import('../utils/sendPermittedSafeUserOperation');
  await sendPermittedSafeUserOperation({
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
