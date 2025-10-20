import { Hex } from 'viem';

const PKP_ETH_ADDRESS = process.env.PKP_ETH_ADDRESS as Hex;

export interface SetupVincentDelegationParams {}

export async function setupVincentDelegation({}: SetupVincentDelegationParams) {
  // TODO for now, we return the pkp eth address we got manually from Vincent Dashboard
  // I have to create the user account, with the EOA as the auth method, then connect the vincent app to get the pkp
  return PKP_ETH_ADDRESS;
}
