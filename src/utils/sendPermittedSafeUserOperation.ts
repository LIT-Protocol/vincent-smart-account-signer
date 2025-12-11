import { createBundlerClient } from 'viem/account-abstraction';

import { chain } from '../environment/base';
import { pimlicoTransport } from '../environment/safe';

export interface SendPermittedSafeUserOperationParams {
  signedUserOp: any;
}

export async function sendPermittedSafeUserOperation({
  signedUserOp,
}: SendPermittedSafeUserOperationParams) {
  const bundlerClient = createBundlerClient({
    chain,
    transport: pimlicoTransport,
  });

  console.log(`Broadcasting user op to the network...`);

  const userOpHash = await bundlerClient.sendUserOperation(signedUserOp);

  console.log('UserOp blockchain hash:', userOpHash);

  const receipt = await bundlerClient.waitForUserOperationReceipt({
    hash: userOpHash,
  });

  const txHash = receipt.receipt.transactionHash;

  console.log(`tx hash: ${txHash}`);

  return txHash;
}
