import { deserializePermissionAccount } from '@zerodev/permissions';
import { toECDSASigner } from '@zerodev/permissions/signers';
import { createKernelAccountClient, addressToEmptyAccount } from '@zerodev/sdk';
import { Address } from 'viem';

import {
  getAaveApprovalTx,
  getAaveSupplyTx,
  getAaveWithdrawTx,
  getAvailableMarkets,
} from './aave';
import {
  aaveUsdcProviderWalletClient,
  chain,
  kernelVersion,
  entryPoint,
  transport,
  publicClient,
  zerodevPaymaster,
} from './environment';
import { getErc20ReadContract, getErc20WriteContract } from './erc20';

export interface GenerateUserOperationParams {
  accountAddress: Address;
  permittedAddress: Address;
  serializedPermissionAccount: string;
}

export async function generateUserOperation({
  accountAddress,
  permittedAddress,
  serializedPermissionAccount,
}: GenerateUserOperationParams) {
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

  const aaveMarkets = getAvailableMarkets(chain.id);
  const usdcAddress = aaveMarkets['USDC'];
  if (!usdcAddress) {
    throw new Error(`USDC not found in Aave markets for chain ${chain.id}`);
  }

  if (!aaveUsdcProviderWalletClient) {
    console.log(`No Aave USDC provider found. Only approve tx will be bundled`);
  } else {
    const providerAddress = aaveUsdcProviderWalletClient.account.address;

    const usdcWriteContract = getErc20WriteContract(usdcAddress, aaveUsdcProviderWalletClient);
    const providerUsdcBalance = (await usdcWriteContract.read.balanceOf([providerAddress])) as bigint;
    if (providerUsdcBalance <= BigInt(0)) {
      throw new Error(`Wallet ${providerAddress} does not have any USDC to fund the ${accountAddress} account`);
    }

    const fundedUsdcBalance = Math.max(Math.floor(Math.random() * 1_000_000), Number(providerUsdcBalance)); // <1 USDC
    const fundingTx = await usdcWriteContract.write.transfer(
      [
        accountAddress,
        fundedUsdcBalance,
      ],
    );

    await publicClient.waitForTransactionReceipt({
      confirmations: 2,
      hash: fundingTx,
    });

    console.log(`Funded ${accountAddress} account with ${fundedUsdcBalance} USDC base units`);
  }

  const usdcContract = getErc20ReadContract(usdcAddress);
  const accountUsdcBalance = (await usdcContract.read.balanceOf([
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
    });
    aaveTransactions.push(aaveSupplyTx);

    const aaveWithdrawTx = await getAaveWithdrawTx({
      accountAddress,
      amount: (accountUsdcBalance - BigInt(1)).toString(),
      assetAddress: usdcAddress,
      chainId: chain.id,
    });
    aaveTransactions.push(aaveWithdrawTx);
  }

  const callData = await permissionKernelAccount.encodeCalls(
    aaveTransactions.map((tx) => ({ data: tx.data, to: tx.to }))
  );
  return await permissionKernelClient.prepareUserOperation({
    callData,
  });
}
