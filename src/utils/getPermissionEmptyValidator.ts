import { toPermissionValidator } from '@zerodev/permissions';
import { toSudoPolicy } from '@zerodev/permissions/policies';
import { toECDSASigner } from '@zerodev/permissions/signers';
import { addressToEmptyAccount } from '@zerodev/sdk';
import { type Address } from 'viem';

import { entryPoint, kernelVersion, publicClient } from '../environment';

export async function getPermissionEmptyValidator(permittedAddress: Address) {
  const permittedEmptyAccount = addressToEmptyAccount(permittedAddress);
  const permittedEmptySigner = await toECDSASigner({
    signer: permittedEmptyAccount,
  });
  return await toPermissionValidator(publicClient, {
    entryPoint,
    kernelVersion,
    signer: permittedEmptySigner,
    policies: [
      // TODO you probably want to restrict this
      toSudoPolicy({}),
    ],
  });
}
