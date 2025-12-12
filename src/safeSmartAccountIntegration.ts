import { disconnectVincentAbilityClients } from '@lit-protocol/vincent-app-sdk/abilityClient';

import { publicClient } from './environment/base';
import { fundAccount } from './utils/fundAccount';
import {
  generateSupplyTransactions,
  generateWithdrawTransactions,
} from './utils/generateTransactions';
import { getSafeUserOperationSignature } from './utils/getSafeUserOperationSignature';
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

  // First we supply to Aave
  const supplyTransactions = await generateSupplyTransactions({
    accountAddress: safeAccount.address,
  });

  const supplyAaveUserOp = await transactionsToSafeUserOp({
    safeAddress: safeAccount.address,
    permittedAddress: pkpEthAddress,
    transactions: supplyTransactions,
  });

  const supplyUserOperationSignature = await getSafeUserOperationSignature({
    pkpAddress: pkpEthAddress,
    userOp: supplyAaveUserOp,
  });

  // Add signature to User Operation
  const signedSupplyAaveUserOp = {
    ...supplyAaveUserOp,
    signature: supplyUserOperationSignature,
  };

  console.log(`Signed user op: `);
  console.dir(signedSupplyAaveUserOp, { depth: null });

  // Send user operation
  const supplyTxHash = await sendPermittedSafeUserOperation({
    signedUserOp: signedSupplyAaveUserOp,
  });

  await publicClient.waitForTransactionReceipt({
    confirmations: 2,
    hash: supplyTxHash,
  });

  // Then we withdraw from aave
  const withdrawTransactions = await generateWithdrawTransactions({
    accountAddress: safeAccount.address,
  });

  const withdrawAaveUserOp = await transactionsToSafeUserOp({
    transactions: withdrawTransactions,
    safeAddress: safeAccount.address,
    permittedAddress: pkpEthAddress,
  });

  const withdrawUserOperationSignature = await getSafeUserOperationSignature({
    pkpAddress: pkpEthAddress,
    userOp: withdrawAaveUserOp,
  });

  // Add signature to User Operation
  const signedWithdrawAaveUserOp = {
    ...withdrawAaveUserOp,
    signature: withdrawUserOperationSignature,
  };

  console.log(`Signed user op: `);
  console.dir(signedWithdrawAaveUserOp, { depth: null });

  // Send user operation
  const withdrawTxHash = await sendPermittedSafeUserOperation({
    signedUserOp: signedWithdrawAaveUserOp,
  });

  await publicClient.waitForTransactionReceipt({
    confirmations: 2,
    hash: withdrawTxHash,
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
