import { disconnectVincentAbilityClients } from '@lit-protocol/vincent-app-sdk/abilityClient';
import { Address } from 'viem';

import { fundAccount } from './utils/fundAccount';
import {
  generateSupplyTransactions,
  generateWithdrawTransactions,
} from './utils/generateTransactions';
import { getEcdsaUserOperationSignature } from './utils/getEcdsaUserOperationSignature';
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

  // First we supply to Aave
  const supplyTransactions = await generateSupplyTransactions({
    accountAddress: crossmintAccount.address as Address,
  });

  const supplyAaveUserOp = await transactionsToCrossmintUserOp({
    crossmintAccountAddress: crossmintAccount.address as Address,
    permittedAddress: pkpEthAddress,
    transactions: supplyTransactions,
  });

  const supplyUserOperationSignature = await getEcdsaUserOperationSignature({
    pkpAddress: pkpEthAddress,
    userOp: supplyAaveUserOp.onChain.userOperation,
  });

  // CLIENT (APP BACKEND)
  // Send user operation
  await sendPermittedCrossmintUserOperation({
    accountAddress: crossmintAccount.address as Address,
    userOp: supplyAaveUserOp,
    signature: supplyUserOperationSignature,
    signerAddress: pkpEthAddress,
  });

  // Crossmint only returns the user op hash, not the tx so we just wait a few seconds for it
  await new Promise<void>(resolve => setTimeout(() => resolve(), 5_000));

  // Then we withdraw from aave
  const withdrawTransactions = await generateWithdrawTransactions({
    accountAddress: crossmintAccount.address as Address,
  });

  const withdrawAaveUserOp = await transactionsToCrossmintUserOp({
    crossmintAccountAddress: crossmintAccount.address as Address,
    permittedAddress: pkpEthAddress,
    transactions: withdrawTransactions,
  });

  const withdrawUserOperationSignature = await getEcdsaUserOperationSignature({
    pkpAddress: pkpEthAddress,
    userOp: withdrawAaveUserOp.onChain.userOperation,
  });

  // CLIENT (APP BACKEND)
  // Send user operation
  await sendPermittedCrossmintUserOperation({
    accountAddress: crossmintAccount.address as Address,
    userOp: withdrawAaveUserOp,
    signature: withdrawUserOperationSignature,
    signerAddress: pkpEthAddress,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectVincentAbilityClients();

    console.log('Success! User operation sent and executed successfully.');
    process.exit(0);
  });
