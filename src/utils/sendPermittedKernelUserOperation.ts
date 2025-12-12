import { Address } from 'viem';
import { deserializePermissionAccount } from '@zerodev/permissions';
import { toECDSASigner } from '@zerodev/permissions/signers';
import { createKernelAccountClient, addressToEmptyAccount } from '@zerodev/sdk';

import { chain, publicClient } from '../environment/base';
import {
  entryPoint,
  kernelVersion,
  zerodevTransport,
  zerodevPaymaster,
} from '../environment/zerodev';

export interface SendPermittedKernelUserOperationParams {
  permittedAddress: Address;
  serializedPermissionAccount: string;
  signedUserOp: any;
}

export async function sendPermittedKernelUserOperation({
  permittedAddress,
  serializedPermissionAccount,
  signedUserOp,
}: SendPermittedKernelUserOperationParams) {
  const vincentEmptyAccount = addressToEmptyAccount(permittedAddress);
  const vincentAbilitySigner = await toECDSASigner({
    signer: vincentEmptyAccount,
  });

  const permissionKernelAccount = await deserializePermissionAccount(
    publicClient,
    entryPoint,
    kernelVersion,
    serializedPermissionAccount,
    vincentAbilitySigner
  );
  const permissionKernelClient = createKernelAccountClient({
    chain,
    account: permissionKernelAccount,
    bundlerTransport: zerodevTransport,
    client: publicClient,
    paymaster: {
      getPaymasterData(userOperation) {
        return zerodevPaymaster.sponsorUserOperation({ userOperation });
      },
    },
  });

  console.log(`Broadcasting user op to the network...`);
  const aaveUserOpHash =
    await permissionKernelClient.sendUserOperation(signedUserOp);
  console.log('UserOp hash:', aaveUserOpHash);

  const aaveUserOpReceipt =
    await permissionKernelClient.waitForUserOperationReceipt({
      hash: aaveUserOpHash,
    });

  const txHash = aaveUserOpReceipt.receipt.transactionHash;

  console.log(`tx hash: ${txHash}`);

  return txHash;
}
