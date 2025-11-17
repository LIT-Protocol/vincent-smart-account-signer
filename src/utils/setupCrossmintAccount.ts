import { type Address, zeroAddress } from 'viem';
import { PrivateKeyAccount } from 'viem/accounts';

import { chain } from '../environment/base';
import { crossmintWalletApiClient } from '../environment/crossmint';

export interface SetupCrossmintAccountParams {
  ownerAccount: PrivateKeyAccount;
  permittedAddress: Address;
}

export async function setupCrossmintAccount({
  ownerAccount,
  permittedAddress,
}: SetupCrossmintAccountParams) {
  // Set up smart account
  const crossmintAccount = await crossmintWalletApiClient.createWallet({
    chainType: 'evm',
    type: 'smart',
    config: {
      adminSigner: {
        type: 'external-wallet',
        address: ownerAccount.address,
      },
      delegatedSigners: [
        {
          signer: {
            type: 'external-wallet',
            address: permittedAddress,
          },
        },
      ],
    },
  });
  if ('error' in crossmintAccount) {
    throw new Error(`Could not create crossmint smart account. Error: ${JSON.stringify(crossmintAccount.error)}`);
  }

  console.log(`Crossmint Smart Account address: ${crossmintAccount.address}`);

  // Deploy smart account with an empty user op
  const deployUserOp = await crossmintWalletApiClient.createTransaction(
    crossmintAccount.address,
    {
      params: {
        calls: [
          {
            data: '0x',
            to: zeroAddress,
            value: '0',
          },
        ],
        chain: chain.network,
        signer: ownerAccount.address,
      },
    },
  );
  if ('error' in deployUserOp) {
    throw new Error(`Could not create crossmint deploy user operation. Error: ${JSON.stringify(deployUserOp.error)}`);
  }

  const deployUserOpSignature = await ownerAccount.signMessage({
    message: { raw: deployUserOp.onChain.userOperationHash },
  });

  const deployUserOpApproval = await crossmintWalletApiClient.approveTransaction(
    crossmintAccount.address,
    deployUserOp.id,
    {
      approvals: [
        {
          signer: `external-wallet:${ownerAccount.address}`,
          signature: deployUserOpSignature,
        },
      ],
    },
  );
  if ('error' in deployUserOpApproval) {
    throw new Error(`Could not sign crossmint deploy user operation. Error: ${JSON.stringify(deployUserOpApproval.error)}`);
  }


  return {
    crossmintAccount,
  };
}
