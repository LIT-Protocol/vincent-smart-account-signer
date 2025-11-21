import {
  AAVE_POOL_ABI,
  getAaveAddresses,
  getAvailableMarkets,
} from '@lit-protocol/vincent-ability-aave-smart-account';
import { encodeFunctionData, type Address, type Hex } from 'viem';

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
  poolAddress: Address,
  amount = String(Math.floor(Math.random() * 1000))
): Promise<Transaction> {
  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [poolAddress, amount],
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
  const { POOL } = getAaveAddresses(chainId);

  return await buildApprovalTx(accountAddress, assetAddress, POOL, amount);
}

export interface AaveSupplyTxParams {
  accountAddress: Address;
  amount: string;
  assetAddress: Address;
  chainId: number;
  onBehalfOf?: Address;
  referralCode?: number;
}

async function buildSupplyTx(
  accountAddress: Address,
  assetAddress: Address,
  poolAddress: Address,
  amount: string,
  onBehalfOf: Address = accountAddress,
  referralCode: number = 0
): Promise<Transaction> {
  const supplyData = encodeFunctionData({
    abi: AAVE_POOL_ABI,
    functionName: 'supply',
    args: [assetAddress, amount, onBehalfOf, referralCode],
  });
  const supplyTx: Transaction = {
    data: supplyData,
    from: accountAddress,
    to: poolAddress,
    value: ZERO_VALUE,
  };

  return supplyTx;
}

export async function getAaveSupplyTx({
  accountAddress,
  amount,
  assetAddress,
  chainId,
  onBehalfOf,
  referralCode,
}: AaveSupplyTxParams) {
  const { POOL } = getAaveAddresses(chainId);

  return await buildSupplyTx(
    accountAddress,
    assetAddress,
    POOL,
    amount,
    onBehalfOf,
    referralCode
  );
}

export interface AaveWithdrawTxParams {
  accountAddress: Address;
  amount: string;
  assetAddress: Address;
  chainId: number;
  to?: Address;
}

async function buildWithdrawTx(
  accountAddress: Address,
  assetAddress: Address,
  poolAddress: Address,
  amount: string,
  to: Address = accountAddress
): Promise<Transaction> {
  const withdrawData = encodeFunctionData({
    abi: AAVE_POOL_ABI,
    functionName: 'withdraw',
    args: [assetAddress, amount, to],
  });
  const withdrawTx: Transaction = {
    data: withdrawData,
    from: accountAddress,
    to: poolAddress,
    value: ZERO_VALUE,
  };

  return withdrawTx;
}

export async function getAaveWithdrawTx({
  accountAddress,
  amount,
  assetAddress,
  chainId,
  to,
}: AaveWithdrawTxParams) {
  const { POOL } = getAaveAddresses(chainId);

  return await buildWithdrawTx(accountAddress, assetAddress, POOL, amount, to);
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
