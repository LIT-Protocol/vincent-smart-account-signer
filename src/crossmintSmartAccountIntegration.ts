import { toVincentUserOp } from '@lit-protocol/vincent-ability-aave-smart-account';
import { disconnectVincentAbilityClients } from '@lit-protocol/vincent-app-sdk/abilityClient';
import { Address } from 'viem';

import { alchemyRpc } from './environment/base';
import { abilityClient } from './environment/lit';
import { entryPoint } from './environment/zerodev';
import { fundAccount } from './utils/fundAccount';
import { generateTransactions } from './utils/generateTransactions';
import { setupCrossmintSmartAccountAndDelegation } from './utils/setupCrossmintSmartAccountAndDelegation';
import { sendPermittedCrossmintUserOperation } from './utils/sendPermittedCrossmintUserOperation';
import { transactionsToCrossmintUserOp } from './utils/transactionsToCrossmintUserOp';

async function main() {
  // USER
  const { crossmintAccount, pkpEthAddress } =
    await setupCrossmintSmartAccountAndDelegation();

  // CLIENT (APP BACKEND)
  await fundAccount({
    accountAddress: crossmintAccount.address as Address,
  });

  const transactions = await generateTransactions({
    accountAddress: crossmintAccount.address as Address,
  });

  const aaveUserOp = await transactionsToCrossmintUserOp({
    transactions,
    crossmintAccountAddress: crossmintAccount.address as Address,
    permittedAddress: pkpEthAddress,
  });

  console.log(
    `Sending user op and serialized session signer to the Lit Signer...`
  );

  const vincentAbilityParams = {
    alchemyRpcUrl: alchemyRpc,
    entryPointAddress: entryPoint.address,
    userOp: toVincentUserOp(aaveUserOp.onChain.userOperation),
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

  // CLIENT (APP BACKEND)
  // Send user operation
  await sendPermittedCrossmintUserOperation({
    accountAddress: crossmintAccount.address as Address,
    userOp: aaveUserOp,
    signature: executeResult.result.signature,
    signerAddress: pkpEthAddress,
  });

  await disconnectVincentAbilityClients();

  console.log('Success! User operation sent and executed successfully.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
