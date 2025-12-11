import {
  Transaction,
  getAaveApprovalTx,
  getAaveSupplyTx,
  getAaveWithdrawTx,
  getAvailableMarkets,
  getATokens,
} from '@lit-protocol/vincent-ability-aave';
import { Address } from 'viem';

import { chain } from '../environment/base';
import { vincentAppId } from '../environment/lit';
import { getErc20ReadContract } from './erc20';

export interface GenerateTransactionsParams {
  accountAddress: Address;
}

export async function generateSupplyTransactions({
  accountAddress,
}: GenerateTransactionsParams) {
  const aaveMarkets = getAvailableMarkets(chain.id);
  const usdcAddress = aaveMarkets['USDC'];
  if (!usdcAddress) {
    throw new Error(`USDC not found in Aave markets for chain ${chain.id}`);
  }

  const usdcContract = getErc20ReadContract(usdcAddress);
  const accountUsdcBalance = (await usdcContract.read.balanceOf([
    accountAddress,
  ])) as bigint;
  console.log(`Account has ${accountUsdcBalance} USDC`);

  // Create transactions to be bundled
  const aaveTransactions: Transaction[] = [];

  const aaveApprovalTx = getAaveApprovalTx({
    accountAddress,
    amount: accountUsdcBalance.toString(),
    assetAddress: usdcAddress,
    chainId: chain.id,
  });
  aaveTransactions.push(aaveApprovalTx);

  if (accountUsdcBalance === BigInt(0)) {
    throw new Error(
      `No USDC balance found on ${accountAddress} account`
    );
  } else {
    const aaveSupplyTx = getAaveSupplyTx({
      accountAddress,
      appId: vincentAppId,
      amount: accountUsdcBalance.toString(),
      assetAddress: usdcAddress,
      chainId: chain.id,
    });
    aaveTransactions.push(aaveSupplyTx);
  }

  return aaveTransactions;
}

export async function generateWithdrawTransactions({
  accountAddress,
}: GenerateTransactionsParams) {
  const aaveMarkets = getAvailableMarkets(chain.id);
  const usdcAddress = aaveMarkets['USDC'];
  if (!usdcAddress) {
    throw new Error(`USDC not found in Aave markets for chain ${chain.id}`);
  }

  const aTokens = getATokens(chain.id);
  const aUsdcAddress = aTokens['USDC'];
  if (!aUsdcAddress) {
    throw new Error(
      `aUSDC not found in Aave markets for chain ${chain.id}. We must use the same USDC that Aave uses.`
    );
  }

  const aUsdcContract = getErc20ReadContract(aUsdcAddress);
  const accountAUsdcBalance = (await aUsdcContract.read.balanceOf([
    accountAddress,
  ])) as bigint;
  console.log(
    `Account has ${accountAUsdcBalance} aUSDC. Bundling withdraw for max amount`
  );

  // Create transactions to be bundled
  const aaveTransactions: Transaction[] = [];

  if (accountAUsdcBalance === BigInt(0)) {
    throw new Error(
      `No aUSDC balance found on ${accountAddress} account`
    );
  } else {
    const aaveApprovalTx = getAaveApprovalTx({
      accountAddress,
      amount: accountAUsdcBalance.toString(),
      assetAddress: aUsdcAddress,
      chainId: chain.id,
    });
    aaveTransactions.push(aaveApprovalTx);

    const aaveWithdrawTx = getAaveWithdrawTx({
      accountAddress,
      appId: vincentAppId,
      amount: accountAUsdcBalance.toString(),
      assetAddress: usdcAddress,
      chainId: chain.id,
    });
    aaveTransactions.push(aaveWithdrawTx);
  }

  return aaveTransactions;
}
