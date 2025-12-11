import { getAvailableMarkets } from '@lit-protocol/vincent-ability-aave';
import { Address, formatUnits, parseUnits } from 'viem';

import {
  fundsProviderWalletClient,
  chain,
  publicClient,
} from '../environment/base';
import { getErc20ReadContract, getErc20WriteContract } from './erc20';

export interface FundAccountParams {
  accountAddress: Address;
  /**
   * Optional amount of native currency (in wei) to transfer to the account.
   * Defaults to 0n (no native funding).
   */
  nativeFunds?: bigint;
}

/**
 * Ensure the given account has at least 10 USDC by transferring funds
 * from the configured Aave USDC provider wallet if available.
 */
export async function fundAccount({
  accountAddress,
  nativeFunds = 0n,
}: FundAccountParams) {
  const aaveMarkets = getAvailableMarkets(chain.id);
  const usdcAddress = aaveMarkets['USDC'];
  if (!usdcAddress) {
    throw new Error(`USDC not found in Aave markets for chain ${chain.id}`);
  }

  const usdcContract = getErc20ReadContract(usdcAddress);
  const accountUsdcBalance = (await usdcContract.read.balanceOf([
    accountAddress,
  ])) as bigint;

  // Try to fund with 10 USDC. USDC has 6 decimals.
  const fundedUsdcBalance = parseUnits('10', 6);
  if (!fundsProviderWalletClient) {
    console.log(`No Aave USDC provider found. We will skip funding the account.`);
    return;
  }

  // Optionally transfer native funds first, independent of USDC balance
  if (nativeFunds > 0n) {
    const providerAddress = fundsProviderWalletClient.account.address;
    const providerNativeBalance = await publicClient.getBalance({
      address: providerAddress,
    });
    if (nativeFunds > providerNativeBalance) {
      throw new Error(
        `Wallet ${providerAddress} does not have enough native funds to send ${nativeFunds} wei to ${accountAddress}.`
      );
    }

    const nativeTx = await fundsProviderWalletClient.sendTransaction({
      chain,
      account: fundsProviderWalletClient.account!,
      to: accountAddress,
      value: nativeFunds,
    });

    await publicClient.waitForTransactionReceipt({
      confirmations: 2,
      hash: nativeTx,
    });

    console.log(
      `Funded ${accountAddress} account with ${nativeFunds} wei of native currency`
    );
  }

  // USDC funding only if needed
  if (accountUsdcBalance >= fundedUsdcBalance) {
    return; // account already has enough USDC
  }

  console.log(
    `Account has ${formatUnits(accountUsdcBalance, 6)} USDC. Funding account with 10 more USDC.`
  );

  const providerAddress = fundsProviderWalletClient.account.address;
  const usdcWriteContract = getErc20WriteContract(
    usdcAddress,
    fundsProviderWalletClient
  );

  const providerUsdcBalance = (await usdcWriteContract.read.balanceOf([
    providerAddress,
  ])) as bigint;
  if (fundedUsdcBalance > providerUsdcBalance) {
    throw new Error(
      `Wallet ${providerAddress} does not have enough USDC (token address: ${usdcAddress}) to fund the ${accountAddress} account. You need to fund the wallet with 10 USDC.`
    );
  }

  const fundingTx = await usdcWriteContract.write.transfer([
    accountAddress,
    fundedUsdcBalance,
  ]);

  await publicClient.waitForTransactionReceipt({
    confirmations: 2,
    hash: fundingTx,
  });

  console.log(
    `Funded ${accountAddress} account with ${fundedUsdcBalance} USDC base units`
  );
}
