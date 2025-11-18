import { serializePermissionAccount } from '@zerodev/permissions';
import { createKernelAccount, KernelValidator } from '@zerodev/sdk';
import { Address } from 'viem';

import { publicClient } from '../environment/base';
import { kernelVersion, entryPoint } from '../environment/zerodev';
import { getPermissionEmptyValidator } from './getPermissionEmptyValidator';

export interface GenerateZeroDevSessionKeyParams {
  accountAddress: Address;
  ownerValidator: KernelValidator;
  permittedAddress: Address;
}

export async function generateZeroDevPermissionAccount({
  accountAddress,
  ownerValidator,
  permittedAddress,
}: GenerateZeroDevSessionKeyParams) {
  const permissionValidator =
    await getPermissionEmptyValidator(permittedAddress);

  const permissionKernelAccountToSerialize = await createKernelAccount(
    publicClient,
    {
      entryPoint,
      kernelVersion,
      address: accountAddress,
      plugins: {
        sudo: ownerValidator,
        regular: permissionValidator,
      },
    }
  );

  return await serializePermissionAccount(permissionKernelAccountToSerialize);
}
