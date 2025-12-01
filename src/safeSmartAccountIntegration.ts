import { toVincentUserOp, safeEip712Params } from '@lit-protocol/vincent-ability-aave-smart-account';
import { disconnectVincentAbilityClients } from '@lit-protocol/vincent-app-sdk/abilityClient';
import { Address, Hex, concat, toHex } from 'viem';

import { alchemyRpc } from './environment/base';
import { abilityClient } from './environment/lit';
import { entryPoint } from './environment/safe';
import { fundAccount } from './utils/fundAccount';
import { generateTransactions } from './utils/generateTransactions';
import { sendPermittedSafeUserOperation } from './utils/sendPermittedSafeUserOperation';
import { setupSafeSmartAccountAndDelegation } from './utils/setupSafeSmartAccountAndDelegation';
import { transactionsToSafeUserOp } from './utils/transactionsToSafeUserOp';

async function main() {
  // USER
  const { safeAccount, pkpEthAddress } =
    await setupSafeSmartAccountAndDelegation();

  // CLIENT (APP BACKEND)
  await fundAccount({
    accountAddress: safeAccount.address,
  });

  const transactions = await generateTransactions({
    accountAddress: safeAccount.address,
  });

  const aaveUserOp = await transactionsToSafeUserOp({
    transactions,
    safeAddress: safeAccount.address,
    permittedAddress: pkpEthAddress,
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
    safe4337ModuleAddress: '0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226' as Address, // Using the default one
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

  // Add signature to User Operation
  const signedAaveUserOp = {
    ...aaveUserOp,
    // Safe signatures have the following shape [validAfter (6 bytes)][validUntil (6 bytes)][sig (ECDSA)][maybe-module]
    signature: concat([toHex(validAfter, { size: 6 }), toHex(validUntil, { size: 6 }), executeResult.result.signature as Hex]),
  };

  console.log(`Signed user op: `);
  console.dir(signedAaveUserOp, { depth: null });

  // Send user operation
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
