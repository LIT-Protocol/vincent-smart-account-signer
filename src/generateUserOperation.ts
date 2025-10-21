import { deserializePermissionAccount } from '@zerodev/permissions';
import { toECDSASigner } from '@zerodev/permissions/signers';
import { createKernelAccountClient, addressToEmptyAccount } from '@zerodev/sdk';
import { Address } from 'viem';

import { getAaveApprovalTx } from './aave';
import {
  chain,
  kernelVersion,
  entryPoint,
  transport,
  publicClient,
  zerodevPaymaster,
} from './environment';

export interface GenerateUserOperationParams {
  accountAddress: Address;
  permittedAddress: Address;
  serializedPermissionAccount: string;
}

export async function generateUserOperation({
  accountAddress,
  permittedAddress,
  serializedPermissionAccount,
}: GenerateUserOperationParams) {
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

  // Prepare user operation
  const aaveApprovalTx = await getAaveApprovalTx({
    accountAddress,
    chainId: chain.id,
  });
  const callData = await permissionKernelAccount.encodeCalls([
    {
      data: aaveApprovalTx.data,
      to: aaveApprovalTx.to,
      value: BigInt(0),
    },
  ]);
  return await permissionKernelClient.prepareUserOperation({
    callData,
  });
}
