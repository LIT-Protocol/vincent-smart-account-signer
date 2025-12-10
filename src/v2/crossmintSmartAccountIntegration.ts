import { toVincentUserOp } from '@lit-protocol/vincent-ability-aave-smart-account';
import type { SmartAccountInfo } from '@lit-protocol/vincent-e2e-test-utils';
import { disconnectVincentAbilityClients } from '@lit-protocol/vincent-app-sdk/abilityClient';
import { Hex } from 'viem';

import { alchemyRpc } from '../environment/base';
import { abilityClient } from '../environment/lit';
import { entryPoint } from '../environment/zerodev';
import { fundAccount } from '../utils/fundAccount';
import { generateTransactions } from '../utils/generateTransactions';
import { transactionsToCrossmintUserOp } from '../utils/transactionsToCrossmintUserOp';
import { setupVincentDevelopment } from './setupVincentDelegation';
import { executeVincentAbility } from './executeVincentAbility';

async function main() {
  // USER - Complete setup using e2e-test-utils
  const result = await setupVincentDevelopment('crossmint');

  if (!result.smartAccount) {
    throw new Error('Smart account was not created');
  }

  const smartAccount = result.smartAccount as SmartAccountInfo;
  const crossmintAccount = smartAccount.account;
  const pkpEthAddress = result.agentPkpInfo.ethAddress;

  console.log('\n📋 Using Crossmint Account:', crossmintAccount.address);
  console.log('🔑 PKP Address:', pkpEthAddress);

  // CLIENT (APP BACKEND)
  await fundAccount({
    accountAddress: crossmintAccount.address as Hex,
  });

  const transactions = await generateTransactions({
    accountAddress: crossmintAccount.address as Hex,
  });

  const aaveUserOp = await transactionsToCrossmintUserOp({
    transactions,
    crossmintAccountAddress: crossmintAccount.address as Hex,
    permittedAddress: pkpEthAddress as Hex,
  });

  // Type guard to ensure we have the userOperation variant
  if (!('userOperation' in aaveUserOp.onChain)) {
    throw new Error('Expected userOperation in Crossmint transaction response');
  }

  console.log(
    `Sending user op and serialized session signer to the Lit Signer...`
  );

  const vincentAbilityParams = {
    alchemyRpcUrl: alchemyRpc,
    entryPointAddress: entryPoint.address,
    userOp: toVincentUserOp(aaveUserOp.onChain.userOperation),
  };

  const signature = await executeVincentAbility({
    abilityClient,
    vincentAbilityParams,
    delegatorPkpEthAddress: pkpEthAddress as Hex,
  });

  // Add signature to User Operation
  const signedAaveUserOp = {
    ...aaveUserOp,
    onChain: {
      ...aaveUserOp.onChain,
      userOperation: {
        ...aaveUserOp.onChain.userOperation,
        signature,
      },
    },
  };

  // Send user operation
  const { sendPermittedCrossmintUserOperation } = await import('../utils/sendPermittedCrossmintUserOperation');
  await sendPermittedCrossmintUserOperation({
    accountAddress: crossmintAccount.address as Hex,
    userOp: signedAaveUserOp,
    signature,
    signerAddress: pkpEthAddress as Hex,
  });

  await disconnectVincentAbilityClients();

  console.log('Success! User operation sent and executed successfully.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
