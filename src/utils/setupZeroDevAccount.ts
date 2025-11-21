import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { toInitConfig } from '@zerodev/permissions';
import { createKernelAccount, createKernelAccountClient } from '@zerodev/sdk';
import { type Address, zeroAddress } from 'viem';
import { PrivateKeyAccount } from 'viem/accounts';

import { chain, publicClient } from '../environment/base';
import {
  entryPoint,
  kernelVersion,
  zerodevTransport,
  zerodevPaymaster,
} from '../environment/zerodev';
import { getPermissionEmptyValidator } from './getPermissionEmptyValidator';

export interface SetupZeroDevAccountParams {
  ownerAccount: PrivateKeyAccount;
  permittedAddress: Address;
}

export async function setupZeroDevAccount({
  ownerAccount,
  permittedAddress,
}: SetupZeroDevAccountParams) {
  // Owner validator
  const ownerValidator = await signerToEcdsaValidator(publicClient, {
    entryPoint,
    kernelVersion,
    signer: ownerAccount,
  });

  // Permitted signer empty validator
  const permissionValidator =
    await getPermissionEmptyValidator(permittedAddress);

  // Set up smart account
  const ownerKernelAccount = await createKernelAccount(publicClient, {
    entryPoint,
    kernelVersion,
    plugins: {
      sudo: ownerValidator,
    },
    initConfig: await toInitConfig(permissionValidator),
  });

  console.log(
    `ZeroDev Kernel Smart Account address: ${ownerKernelAccount.address}`
  );

  const ownerKernelClient = createKernelAccountClient({
    chain,
    account: ownerKernelAccount,
    bundlerTransport: zerodevTransport,
    client: publicClient,
    paymaster: {
      getPaymasterData(userOperation) {
        return zerodevPaymaster.sponsorUserOperation({ userOperation });
      },
    },
  });

  // Deploy smart account with an empty user op
  const deployUserOpHash = await ownerKernelClient.sendUserOperation({
    callData: await ownerKernelAccount.encodeCalls([
      {
        to: zeroAddress,
        value: BigInt(0),
        data: '0x',
      },
    ]),
  });
  console.log('Deployment userOp hash:', deployUserOpHash);

  const deployUserOpReceipt =
    await ownerKernelClient.waitForUserOperationReceipt({
      hash: deployUserOpHash,
    });
  console.log({ txHash: deployUserOpReceipt.receipt.transactionHash });

  return {
    ownerKernelAccount,
    ownerValidator,
  };
}
