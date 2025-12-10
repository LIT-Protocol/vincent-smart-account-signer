import { type Address, type Hex } from 'viem';

import { chain } from '../environment/base';
import { crossmintWalletApiClient } from '../environment/crossmint';
import { Transaction } from '../aave';

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

  // Convert user operation string types to Hex types if onChain.userOperation exists
  if ('userOperation' in crossmintUserOp.onChain) {
    const userOp = crossmintUserOp.onChain.userOperation;
    const typedUserOp: any = {
      sender: userOp.sender as Hex,
      nonce: userOp.nonce as Hex,
      callData: userOp.callData as Hex,
      callGasLimit: userOp.callGasLimit as Hex,
      verificationGasLimit: userOp.verificationGasLimit as Hex,
      preVerificationGas: userOp.preVerificationGas as Hex,
      maxFeePerGas: userOp.maxFeePerGas as Hex,
      maxPriorityFeePerGas: userOp.maxPriorityFeePerGas as Hex,
    };

    if (userOp.paymaster) typedUserOp.paymaster = userOp.paymaster as Hex;
    if (userOp.paymasterData) typedUserOp.paymasterData = userOp.paymasterData as Hex;
    if (userOp.paymasterVerificationGasLimit) typedUserOp.paymasterVerificationGasLimit = userOp.paymasterVerificationGasLimit as Hex;
    if (userOp.paymasterPostOpGasLimit) typedUserOp.paymasterPostOpGasLimit = userOp.paymasterPostOpGasLimit as Hex;
    if (userOp.signature) typedUserOp.signature = userOp.signature as Hex;
    if (userOp.factory) typedUserOp.factory = userOp.factory as Hex;
    if (userOp.factoryData) typedUserOp.factoryData = userOp.factoryData as Hex;

    return {
      ...crossmintUserOp,
      onChain: {
        ...crossmintUserOp.onChain,
        userOperation: typedUserOp,
      },
    };
  }

  return crossmintUserOp;
}
