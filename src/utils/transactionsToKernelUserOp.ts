import { deserializePermissionAccount } from '@zerodev/permissions';
import { toECDSASigner } from '@zerodev/permissions/signers';
import { createKernelAccountClient, addressToEmptyAccount } from '@zerodev/sdk';
import { type Address } from 'viem';

import { chain, publicClient, transport } from '../environment/base';
import {
  entryPoint,
  kernelVersion,
  zerodevPaymaster,
} from '../environment/zerodev';
import { Transaction } from '../aave';

export interface TransactionsToKernelUserOpParams {
  permittedAddress: Address;
  serializedPermissionAccount: string;
  transactions: Transaction[];
}
export async function transactionsToKernelUserOp({
  permittedAddress,
  serializedPermissionAccount,
  transactions,
}: TransactionsToKernelUserOpParams) {
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
