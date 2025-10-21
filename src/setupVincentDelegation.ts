import { Hex } from 'viem';
import { PrivateKeyAccount } from 'viem/accounts';

const PKP_ETH_ADDRESS = process.env.PKP_ETH_ADDRESS as Hex;

export interface SetupVincentDelegationParams {
  ownerAccount: PrivateKeyAccount;
}

export async function setupVincentDelegation({
                                               ownerAccount,
                                             }: SetupVincentDelegationParams) {
  if (!PKP_ETH_ADDRESS) {
    throw new Error('Missing PKP_ETH_ADDRESS env variable');
  }

  return PKP_ETH_ADDRESS;
}
