import { disconnectVincentAbilityClients } from '@lit-protocol/vincent-app-sdk/abilityClient';

import { publicClient } from './environment/base';
import { fundAccount } from './utils/fundAccount';
import {
  generateSupplyTransactions,
  generateWithdrawTransactions,
} from './utils/generateTransactions';
import { getKernelUserOperationSignature } from './utils/getKernelUserOperationSignature';
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

  // First we supply to Aave
  const supplyTransactions = await generateSupplyTransactions({
    accountAddress: ownerKernelAccount.address,
  });

  const supplyAaveUserOp = await transactionsToKernelUserOp({
    serializedPermissionAccount,
    permittedAddress: pkpEthAddress,
    transactions: supplyTransactions,
  });

  const supplyUserOperationSignature = await getKernelUserOperationSignature({
    pkpAddress: pkpEthAddress,
    secondValidatorId: '0xff',
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
  const supplyTxHash = await sendPermittedKernelUserOperation({
    serializedPermissionAccount,
    permittedAddress: pkpEthAddress,
    signedUserOp: signedSupplyAaveUserOp,
  });

  await publicClient.waitForTransactionReceipt({
    confirmations: 2,
    hash: supplyTxHash,
  });

  // Then we withdraw from aave
  const withdrawTransactions = await generateWithdrawTransactions({
    accountAddress: ownerKernelAccount.address,
  });

  const withdrawAaveUserOp = await transactionsToKernelUserOp({
    serializedPermissionAccount,
    permittedAddress: pkpEthAddress,
    transactions: withdrawTransactions,
  });

  const withdrawUserOperationSignature = await getKernelUserOperationSignature({
    pkpAddress: pkpEthAddress,
    secondValidatorId: '0xff',
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
  const withdrawTxHash = await sendPermittedKernelUserOperation({
    serializedPermissionAccount,
    permittedAddress: pkpEthAddress,
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
