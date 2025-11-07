import {
  serializePermissionAccount,
  toPermissionValidator,
} from '@zerodev/permissions';
import { toSudoPolicy } from '@zerodev/permissions/policies';
import { toECDSASigner } from '@zerodev/permissions/signers';
import {
  createKernelAccount,
  addressToEmptyAccount,
  KernelValidator,
} from '@zerodev/sdk';
import { Address } from 'viem';

import { kernelVersion, entryPoint, publicClient } from '../environment';

export interface GenerateZeroDevSessionKeyParams {
  permittedAddress: Address;
  ownerValidator: KernelValidator;
}

export async function generateZeroDevPermissionAccount({
  permittedAddress,
  ownerValidator,
}: GenerateZeroDevSessionKeyParams) {
  const sessionEmptyAccount = addressToEmptyAccount(permittedAddress);
  const sessionEmptySigner = await toECDSASigner({
    signer: sessionEmptyAccount,
  });
  const permissionValidator = await toPermissionValidator(publicClient, {
    entryPoint,
    kernelVersion,
    signer: sessionEmptySigner,
    policies: [
      // TODO you probably want to restrict this
      toSudoPolicy({}),
    ],
  });
  const permissionKernelAccountToSerialize = await createKernelAccount(
    publicClient,
    {
      entryPoint,
      kernelVersion,
      plugins: {
        sudo: ownerValidator,
        regular: permissionValidator,
      },
    }
  );
  return await serializePermissionAccount(permissionKernelAccountToSerialize);
}
