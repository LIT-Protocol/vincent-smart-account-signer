import { toSafeSmartAccount } from 'permissionless/accounts';
import { createSmartAccountClient } from 'permissionless';
import { type Address } from 'viem';

import { Transaction } from '../aave';
import { addressToAccount } from './addressToAccount';
import { chain, publicClient } from '../environment/base';
import { entryPoint, pimlicoTransport, pimlicoClient, safeVersion } from '../environment/safe';

export interface TransactionsToSafeUserOpParams {
  safeAddress: Address;
  permittedAddress: Address;
  transactions: Transaction[];
}

export async function transactionsToSafeUserOp({
  safeAddress,
  permittedAddress,
  transactions,
}: TransactionsToSafeUserOpParams) {
  // Create a dummy signer for the PKP address
  const dummySigner = addressToAccount({ address: permittedAddress });

  // We re-instantiate the account using the Safe address and the dummy PKP as the signer
  const safeAccount = await toSafeSmartAccount({
    entryPoint,
    address: safeAddress,
    client: publicClient,
    owners: [dummySigner],
    version: safeVersion,
  });

  const safeClient = createSmartAccountClient({
    chain,
    account: safeAccount,
    bundlerTransport: pimlicoTransport,
    client: publicClient,
    paymaster: pimlicoClient,
  });

  const calls = transactions.map((tx) => ({ data: tx.data, to: tx.to }));
  const aaveUserOp = await safeClient.prepareUserOperation({
    calls,
    account: safeAccount,
  });

  console.log(`Aave unsigned userOp:`);
  console.dir(aaveUserOp, { depth: null });

  return aaveUserOp;
}
