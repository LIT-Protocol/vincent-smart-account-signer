import { createSmartAccountClient } from 'permissionless';
import { toSafeSmartAccount } from 'permissionless/accounts';
import { type Address, encodeFunctionData, parseAbi } from 'viem';
import { PrivateKeyAccount } from 'viem/accounts';

import { chain, publicClient } from '../environment/base';
import {
  entryPoint,
  pimlicoTransport,
  pimlicoClient,
  safeVersion,
} from '../environment/safe';

async function encodeAddOwnerWithThresholdCall(
  newOwner: Address,
  threshold: bigint
) {
  const abi = parseAbi([
    'function addOwnerWithThreshold(address owner, uint256 _threshold) public',
  ]);
  return encodeFunctionData({
    abi,
    functionName: 'addOwnerWithThreshold',
    args: [newOwner, threshold],
  });
}

export interface SetupSafeAccountParams {
  ownerAccount: PrivateKeyAccount;
  permittedAddress: Address;
}

export async function setupSafeAccount({
  ownerAccount,
  permittedAddress,
}: SetupSafeAccountParams) {
  // Create the Safe account with the owner
  const safeAccount = await toSafeSmartAccount({
    entryPoint,
    client: publicClient,
    owners: [ownerAccount],
    version: safeVersion,
  });

  console.log(`Safe Smart Account address: ${safeAccount.address}`);

  const safeClient = createSmartAccountClient({
    account: safeAccount,
    chain,
    bundlerTransport: pimlicoTransport,
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        return (await pimlicoClient.getUserOperationGasPrice()).fast;
      },
    },
  });

  // We want to include the PKP (permittedAddress) as an owner too.
  // We'll use threshold 1 for simplicity so either can sign completely
  const addOwnerCallData = await encodeAddOwnerWithThresholdCall(
    permittedAddress,
    1n
  );

  console.log('Deploying Safe and adding PKP as owner...');
  const txHash = await safeClient.sendTransaction({
    to: safeAccount.address,
    value: 0n,
    data: addOwnerCallData,
  });

  console.log('Setup transaction hash:', txHash);

  // Wait for receipt
  const receipt = await publicClient.waitForTransactionReceipt({
    confirmations: 2,
    hash: txHash,
  });
  console.log(`Setup complete. Block number: ${receipt.blockNumber}`);

  return {
    safeAccount,
    safeClient,
  };
}
