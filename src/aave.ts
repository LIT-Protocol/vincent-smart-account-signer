import {
  AAVE_POOL_ABI,
  getAaveAddresses,
  getAvailableMarkets,
  getFeeContractAddress,
} from '@lit-protocol/vincent-ability-aave-smart-account';
import { encodeFunctionData, type Address, type Hex } from 'viem';
import FeeDiamondAbi from '@lit-protocol/vincent-contracts-sdk/dist/abis/FeeDiamond.abi.json';

import { ERC20_ABI } from './utils/erc20';

export { getAaveAddresses, getAvailableMarkets };

const ZERO_VALUE: Hex = '0x0';

export interface Transaction {
  data: Hex;
  from: Address;
  to: Address;
  value: Hex;
}

async function buildApprovalTx(
  accountAddress: Address,
  assetAddress: Address,
  feeContractAddress: Address,
  amount = String(Math.floor(Math.random() * 1000))
): Promise<Transaction> {
  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [feeContractAddress, amount],
  });
  const approveTx: Transaction = {
    data: approveData,
    from: accountAddress,
    to: assetAddress,
    value: ZERO_VALUE,
  };

  return approveTx;
}

export interface AaveApprovalTxParams {
  accountAddress: Address;
  amount?: string;
  assetAddress: Address;
  chainId: number;
}

export async function getAaveApprovalTx({
  accountAddress,
  assetAddress,
  chainId,
  amount,
}: AaveApprovalTxParams) {
  const feeContractAddress = getFeeContractAddress(chainId);
  if (!feeContractAddress) {
    throw new Error(`Fee contract address not found for chain ${chainId}`);
  }
  return await buildApprovalTx(
    accountAddress,
    assetAddress,
    feeContractAddress,
    amount
  );
}

export interface AaveSupplyTxParams {
  accountAddress: Address;
  amount: string;
  assetAddress: Address;
  chainId: number;
  appId: number;
}

async function buildSupplyTx(
  accountAddress: Address,
  assetAddress: Address,
  feeContractAddress: Address,
  amount: string,
  appId: number
): Promise<Transaction> {
  // const supplyData = encodeFunctionData({
  //   abi: AAVE_POOL_ABI,
  //   functionName: 'supply',
  //   args: [assetAddress, amount, onBehalfOf, referralCode],
  // });
  const supplyData = encodeFunctionData({
    abi: FeeDiamondAbi,
    functionName: 'depositToAave',
    args: [appId, assetAddress, amount],
  });
  const supplyTx: Transaction = {
    data: supplyData,
    from: accountAddress,
    to: feeContractAddress,
    value: ZERO_VALUE,
  };

  return supplyTx;
}

export async function getAaveSupplyTx({
  accountAddress,
  amount,
  assetAddress,
  chainId,
  appId,
}: AaveSupplyTxParams) {
  const feeContractAddress = getFeeContractAddress(chainId);

  return await buildSupplyTx(
    accountAddress,
    assetAddress,
    feeContractAddress,
    amount,
    appId
  );
}

export interface AaveWithdrawTxParams {
  accountAddress: Address;
  amount: string;
  assetAddress: Address;
  chainId: number;
  appId: number;
}

async function buildWithdrawTx(
  accountAddress: Address,
  assetAddress: Address,
  feeContractAddress: Address,
  amount: string,
  appId: number
): Promise<Transaction> {
  // const withdrawData = encodeFunctionData({
  //   abi: AAVE_POOL_ABI,
  //   functionName: 'withdraw',
  //   args: [assetAddress, amount, to],
  // });
  const withdrawData = encodeFunctionData({
    abi: FeeDiamondAbi,
    functionName: 'withdrawFromAave',
    args: [appId, assetAddress, amount],
  });
  const withdrawTx: Transaction = {
    data: withdrawData,
    from: accountAddress,
    to: feeContractAddress,
    value: ZERO_VALUE,
  };

  return withdrawTx;
}

export async function getAaveWithdrawTx({
  accountAddress,
  amount,
  assetAddress,
  chainId,
  appId,
}: AaveWithdrawTxParams) {
  const feeContractAddress = getFeeContractAddress(chainId);

  return await buildWithdrawTx(
    accountAddress,
    assetAddress,
    feeContractAddress,
    amount,
    appId
  );
}

export interface AaveBorrowTxParams {
  accountAddress: Address;
  amount: string;
  assetAddress: Address;
  chainId: number;
  interestRateMode?: number;
  onBehalfOf?: Address;
  referralCode?: number;
}

async function buildBorrowTx(
  accountAddress: Address,
  assetAddress: Address,
  poolAddress: Address,
  amount: string,
  interestRateMode: number = 2, // 2 for variable rate, 1 for stable
  onBehalfOf: Address = accountAddress,
  referralCode: number = 0
): Promise<Transaction> {
  const borrowData = encodeFunctionData({
    abi: AAVE_POOL_ABI,
    functionName: 'borrow',
    args: [assetAddress, amount, interestRateMode, referralCode, onBehalfOf],
  });
  const borrowTx: Transaction = {
    data: borrowData,
    from: accountAddress,
    to: poolAddress,
    value: ZERO_VALUE,
  };

  return borrowTx;
}

export async function getAaveBorrowTx({
  accountAddress,
  amount,
  assetAddress,
  chainId,
  interestRateMode,
  onBehalfOf,
  referralCode,
}: AaveBorrowTxParams) {
  const { POOL } = getAaveAddresses(chainId);

  return await buildBorrowTx(
    accountAddress,
    assetAddress,
    POOL,
    amount,
    interestRateMode,
    onBehalfOf,
    referralCode
  );
}

export interface AaveRepayTxParams {
  accountAddress: Address;
  amount: string;
  assetAddress: Address;
  chainId: number;
  interestRateMode?: number;
  onBehalfOf?: Address;
}

async function buildRepayTx(
  accountAddress: Address,
  assetAddress: Address,
  poolAddress: Address,
  amount: string,
  interestRateMode: number = 2, // 2 for variable rate, 1 for stable
  onBehalfOf: Address = accountAddress
): Promise<Transaction> {
  const repayData = encodeFunctionData({
    abi: AAVE_POOL_ABI,
    functionName: 'repay',
    args: [assetAddress, amount, interestRateMode, onBehalfOf],
  });
  const repayTx: Transaction = {
    data: repayData,
    from: accountAddress,
    to: poolAddress,
    value: ZERO_VALUE,
  };

  return repayTx;
}

export async function getAaveRepayTx({
  accountAddress,
  amount,
  assetAddress,
  chainId,
  interestRateMode,
  onBehalfOf,
}: AaveRepayTxParams) {
  const { POOL } = getAaveAddresses(chainId);

  return await buildRepayTx(
    accountAddress,
    assetAddress,
    POOL,
    amount,
    interestRateMode,
    onBehalfOf
  );
}
