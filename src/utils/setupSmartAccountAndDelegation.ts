import { setupZeroDevAccount } from './setupZeroDevAccount';
import { setupVincentDelegation } from './setupVincentDelegation';
import { generateZeroDevPermissionAccount } from './generateZeroDevPermissionAccount';
import { ownerAccount, vincentAppId } from '../environment';

export async function setupSmartAccountAndDelegation() {
  // Set up smart account owner/delegator
  const { ownerValidator, ownerKernelAccount } = await setupZeroDevAccount({
    ownerAccount,
  });
  const pkpEthAddress = await setupVincentDelegation({
    ownerAccount,
    vincentAppId,
  });

  // Generate and serialize the session
  const serializedPermissionAccount = await generateZeroDevPermissionAccount({
    permittedAddress: pkpEthAddress,
    ownerValidator,
  });
  return {
    ownerKernelAccount,
    pkpEthAddress,
    serializedPermissionAccount,
  };
}
