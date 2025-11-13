import { ownerAccount, vincentAppId } from '../environment';
import { setupZeroDevAccount } from './setupZeroDevAccount';
import { setupVincentDelegation } from './setupVincentDelegation';
import { generateZeroDevPermissionAccount } from './generateZeroDevPermissionAccount';

export async function setupSmartAccountAndDelegation() {
  // Get pkp to delegate signatures
  const pkpEthAddress = await setupVincentDelegation({
    ownerAccount,
    vincentAppId,
  });

  // Set up smart account owner/delegator
  const { ownerValidator, ownerKernelAccount } = await setupZeroDevAccount({
    ownerAccount,
    permittedAddress: pkpEthAddress,
  });

  // Generate and serialize the session
  const serializedPermissionAccount = await generateZeroDevPermissionAccount({
    accountAddress: ownerKernelAccount.address,
    permittedAddress: pkpEthAddress,
    ownerValidator,
  });

  return {
    ownerKernelAccount,
    pkpEthAddress,
    serializedPermissionAccount,
  };
}
