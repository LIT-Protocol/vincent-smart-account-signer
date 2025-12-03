import { Address } from 'viem';

import {
  getAaveApprovalTx,
  getAaveSupplyTx,
  getAaveWithdrawTx,
  getAvailableMarkets,
} from '../aave';
import { chain } from '../environment/base';
import { getErc20ReadContract } from './erc20';

export interface GenerateTransactionsParams {
  accountAddress: Address;
  vincentAppId: number;
}

export async function generateTransactions({
  accountAddress,
  vincentAppId,
}: GenerateTransactionsParams) {
  const aaveMarkets = getAvailableMarkets(chain.id);
  const usdcAddress = aaveMarkets['USDC'];
  if (!usdcAddress) {
    throw new Error(`USDC not found in Aave markets for chain ${chain.id}`);
  }

  const usdcContract = getErc20ReadContract(usdcAddress);
  let accountUsdcBalance: bigint = (await usdcContract.read.balanceOf([
    accountAddress,
  ])) as bigint;

  // Create transactions to be bundled
  const aaveTransactions = [];

  const aaveApprovalTx = await getAaveApprovalTx({
    accountAddress,
    amount: accountUsdcBalance.toString(),
    assetAddress: usdcAddress,
    chainId: chain.id,
  });
  aaveTransactions.push(aaveApprovalTx);

  if (accountUsdcBalance === BigInt(0)) {
    console.log(
      `No USDC balance found on ${accountAddress} account. Only approval tx will be bundled`
    );
  } else {
    console.log(
      `Account has ${accountUsdcBalance} USDC. Supplying and withdrawing will be bundled`
    );
    const aaveSupplyTx = await getAaveSupplyTx({
      accountAddress,
      amount: accountUsdcBalance.toString(),
      assetAddress: usdcAddress,
      chainId: chain.id,
      appId: vincentAppId,
    });
    aaveTransactions.push(aaveSupplyTx);

    const aaveWithdrawTx = await getAaveWithdrawTx({
      accountAddress,
      amount: (accountUsdcBalance / BigInt(2)).toString(),
      assetAddress: usdcAddress,
      chainId: chain.id,
      appId: vincentAppId,
    });
    aaveTransactions.push(aaveWithdrawTx);
  }

  return aaveTransactions;
}
