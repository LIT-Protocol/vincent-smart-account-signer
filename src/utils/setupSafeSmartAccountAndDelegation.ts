import { ownerAccount } from '../environment/base';
import { vincentAppId } from '../environment/lit';
import { setupSafeAccount } from './setupSafeAccount';
import { setupVincentDelegation } from './setupVincentDelegation';

export async function setupSafeSmartAccountAndDelegation() {
  // Get pkp to delegate signatures
  const pkpEthAddress = await setupVincentDelegation({
    ownerAccount,
    vincentAppId,
  });

  // Set up smart account owner/delegator and add PKP as signer
  const { safeAccount } = await setupSafeAccount({
    ownerAccount,
    permittedAddress: pkpEthAddress,
  });

  return {
    safeAccount,
    pkpEthAddress,
  };
}
