import { Transaction } from '@lit-protocol/vincent-ability-aave';
import { type Address } from 'viem';

import { chain } from '../environment/base';
import { crossmintWalletApiClient } from '../environment/crossmint';

export interface TransactionsToCrossmintUserOpParams {
  crossmintAccountAddress: Address;
  permittedAddress: Address;
  transactions: Transaction[];
}
export async function transactionsToCrossmintUserOp({
  crossmintAccountAddress,
  permittedAddress,
  transactions,
}: TransactionsToCrossmintUserOpParams) {
  const crossmintUserOp = await crossmintWalletApiClient.createTransaction(
    crossmintAccountAddress,
    {
      params: {
        calls: transactions.map((t) => ({
          data: t.data,
          to: t.to,
          value: '0',
        })),
        chain: chain.network,
        signer: permittedAddress,
      },
    }
  );
  if ('error' in crossmintUserOp) {
    throw new Error(
      `Could not create crossmint user operation. Error: ${JSON.stringify(crossmintUserOp.error)}`
    );
  }

  return crossmintUserOp;
}
