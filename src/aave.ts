import {
  AaveV3Ethereum,
  AaveV3Polygon,
  AaveV3Avalanche,
  AaveV3Arbitrum,
  AaveV3Optimism,
  AaveV3Base,
  AaveV3BNB,
  AaveV3Gnosis,
  AaveV3Scroll,
  AaveV3Metis,
  AaveV3Linea,
  AaveV3ZkSync,
  AaveV3Sepolia,
  AaveV3BaseSepolia,
  AaveV3ArbitrumSepolia,
  AaveV3OptimismSepolia,
  AaveV3ScrollSepolia,
} from '@bgd-labs/aave-address-book';
import { encodeFunctionData, type Abi, type Address, type Hex } from 'viem';

import { ERC20_ABI } from './erc20';

/**
 * AAVE v3 Pool Contract ABI - Essential methods only
 */
export const AAVE_POOL_ABI: Abi = [
  {
    inputs: [
      { internalType: 'address', name: 'asset', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'address', name: 'onBehalfOf', type: 'address' },
      { internalType: 'uint16', name: 'referralCode', type: 'uint16' },
    ],
    name: 'supply',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'asset', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'address', name: 'to', type: 'address' },
    ],
    name: 'withdraw',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

/**
 * Chain id to Aave Address Book mapping
 */
const CHAIN_TO_AAVE_ADDRESS_BOOK: Record<number, any> = {
  // Mainnets
  1: AaveV3Ethereum,
  137: AaveV3Polygon,
  43114: AaveV3Avalanche,
  42161: AaveV3Arbitrum,
  10: AaveV3Optimism,
  8453: AaveV3Base,
  56: AaveV3BNB,
  100: AaveV3Gnosis,
  534352: AaveV3Scroll,
  1088: AaveV3Metis,
  59144: AaveV3Linea,
  324: AaveV3ZkSync,
  // Testnets
  11155111: AaveV3Sepolia,
  84532: AaveV3BaseSepolia,
  421614: AaveV3ArbitrumSepolia,
  11155420: AaveV3OptimismSepolia,
  534351: AaveV3ScrollSepolia,
} as const;

/**
 * Get AAVE addresses for a specific chain using the Aave Address Book
 */
function getAaveAddresses(chainId: number) {
  // First try to get from the official Address Book
  if (chainId in CHAIN_TO_AAVE_ADDRESS_BOOK) {
    try {
      const addressBook = CHAIN_TO_AAVE_ADDRESS_BOOK[chainId];
      return {
        POOL: addressBook.POOL,
        POOL_ADDRESSES_PROVIDER: addressBook.POOL_ADDRESSES_PROVIDER,
      };
    } catch (error) {
      console.warn(
        `Failed to load from Address Book for chain ${chainId}:`,
        error
      );
    }
  }

  throw new Error(
    `Unsupported chain: ${chainId}. Supported chains: ${[
      ...Object.keys(CHAIN_TO_AAVE_ADDRESS_BOOK),
    ].join(', ')}`
  );
}

/**
 * Get available markets (asset addresses) for a specific chain using the Aave Address Book
 */
export function getAvailableMarkets(chainId: number): Record<string, Address> {
  // First try to get from the official Address Book
  if (chainId in CHAIN_TO_AAVE_ADDRESS_BOOK) {
    try {
      const addressBook = CHAIN_TO_AAVE_ADDRESS_BOOK[chainId];
      const markets: Record<string, Address> = {};

      // Extract asset addresses from the address book
      // The address book contains ASSETS object with token addresses
      if (addressBook.ASSETS) {
        Object.keys(addressBook.ASSETS).forEach((assetKey) => {
          const asset = addressBook.ASSETS[assetKey];
          if (asset.UNDERLYING) {
            markets[assetKey] = asset.UNDERLYING;
          }
        });
      }

      return markets;
    } catch (error) {
      console.warn(
        `Failed to load markets from Address Book for ${chainId}:`,
        error
      );
    }
  }

  throw new Error(
    `No markets available for chain: ${chainId}. Supported chains: ${[
      ...Object.keys(CHAIN_TO_AAVE_ADDRESS_BOOK),
    ].join(', ')}`
  );
}

interface Transaction {
  data: Hex;
  from: Address;
  to: Address;
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
