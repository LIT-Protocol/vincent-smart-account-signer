import { Address, Hex } from 'viem';

import { crossmintWalletApiClient } from '../environment/crossmint';

export interface SendPermittedCrossmintUserOperationParams {
  accountAddress: Address;
  signature: Hex;
  signerAddress: Address;
  userOp: any;
}

export async function sendPermittedCrossmintUserOperation({
  accountAddress,
  signature,
  signerAddress,
  userOp,
}: SendPermittedCrossmintUserOperationParams) {
  const userOpAppoval = await crossmintWalletApiClient.approveTransaction(
    accountAddress,
    userOp.id,
    {
      approvals: [
        {
          signer: `external-wallet:${signerAddress}`,
          signature: signature,
        },
      ],
    },
  );
  if ('error' in userOpAppoval) {
    throw new Error(`Could not sign crossmint user operation. Error: ${JSON.stringify(userOpAppoval.error)}`);
  }
}
