import { Address } from 'viem';
import { deserializePermissionAccount } from '@zerodev/permissions';
import { toECDSASigner } from '@zerodev/permissions/signers';
import { createKernelAccountClient, addressToEmptyAccount } from '@zerodev/sdk';

import {
  chain,
  entryPoint,
  kernelVersion,
  publicClient,
  transport,
  zerodevPaymaster,
} from '../environment';

export interface SendPermittedUserOperationParams {
  permittedAddress: Address;
  serializedPermissionAccount: string;
  signedUserOp: any;
}

export async function sendPermittedUserOperation({
  permittedAddress,
  serializedPermissionAccount,
  signedUserOp,
}: SendPermittedUserOperationParams) {
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
    bundlerTransport: transport,
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
  console.log({ txHash: aaveUserOpReceipt.receipt.transactionHash });
}
