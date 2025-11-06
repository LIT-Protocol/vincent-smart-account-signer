import { Address } from 'viem';
import { deserializePermissionAccount } from '@zerodev/permissions';
import { toECDSASigner } from '@zerodev/permissions/signers';
import { createKernelAccountClient, addressToEmptyAccount } from '@zerodev/sdk';
import { toHex } from 'viem';

import {
  chain,
  entryPoint,
  kernelVersion,
  publicClient,
  transport,
  zerodevPaymaster,
} from './environment';
import { Transaction } from './aave';

export interface TransactionsToUserOpParams {
  transactions: Transaction[];
  accountAddress: Address;
  permittedAddress: Address;
  serializedPermissionAccount: string;
}
export async function transactionsToUserOp({
  transactions,
  accountAddress,
  permittedAddress,
  serializedPermissionAccount,
}: TransactionsToUserOpParams) {
  const vincentEmptyAccount = addressToEmptyAccount(permittedAddress);
  const vincentAbilitySigner = await toECDSASigner({
    signer: vincentEmptyAccount,
  });

  const permissionKernelAccount = await deserializePermissionAccount(
    publicClient,
    entryPoint,
    kernelVersion,
    serializedPermissionAccount,
    vincentAbilitySigner
  );
  const permissionKernelClient = createKernelAccountClient({
    chain,
    account: permissionKernelAccount,
    bundlerTransport: transport,
    client: publicClient,
    paymaster: {
      getPaymasterData(userOperation) {
        return zerodevPaymaster.sponsorUserOperation({ userOperation });
      },
    },
  });

  const callData = await permissionKernelAccount.encodeCalls(
    transactions.map((tx) => ({ data: tx.data, to: tx.to }))
  );
  const aaveUserOp = await permissionKernelClient.prepareUserOperation({
    callData,
  });

  console.log(`Aave unsigned userOp:`);
  console.dir(aaveUserOp, { depth: null });

  return aaveUserOp;
}
