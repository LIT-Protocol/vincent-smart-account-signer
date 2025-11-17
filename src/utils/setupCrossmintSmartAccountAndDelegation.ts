import { ownerAccount } from '../environment/base';
import { vincentAppId } from '../environment/lit';
import { setupCrossmintAccount } from './setupCrossmintAccount';
import { setupVincentDelegation } from './setupVincentDelegation';

export async function setupCrossmintSmartAccountAndDelegation() {
  // Get pkp to delegate signatures
  const pkpEthAddress = await setupVincentDelegation({
    ownerAccount,
    vincentAppId,
  });

  // Set up smart account owner/delegator
  const { crossmintAccount } = await setupCrossmintAccount({
    ownerAccount,
    permittedAddress: pkpEthAddress,
  });

  return {
    crossmintAccount,
    pkpEthAddress,
  };
}
