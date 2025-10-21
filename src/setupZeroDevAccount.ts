import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { createKernelAccount, createKernelAccountClient } from '@zerodev/sdk';
import { zeroAddress } from 'viem';
import { PrivateKeyAccount } from 'viem/accounts';

import {
  chain,
  entryPoint,
  kernelVersion,
  publicClient,
  transport,
  zerodevPaymaster,
} from './environment';

export interface SetupZeroDevAccountParams {
  ownerAccount: PrivateKeyAccount;
}

export async function setupZeroDevAccount({
  ownerAccount,
}: SetupZeroDevAccountParams) {
  const ownerValidator = await signerToEcdsaValidator(publicClient, {
    entryPoint,
    kernelVersion,
    signer: ownerAccount,
  });

  // Set up smart account
  const ownerKernelAccount = await createKernelAccount(publicClient, {
    entryPoint,
    kernelVersion,
    plugins: {
      sudo: ownerValidator,
    },
  });

  const accountAddress = ownerKernelAccount.address;
  console.log(`Account address: ${accountAddress}`);

  const ownerKernelClient = createKernelAccountClient({
    chain,
    account: ownerKernelAccount,
    bundlerTransport: transport,
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
    accountAddress,
    ownerKernelAccount,
    ownerValidator,
  };
}
