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
import { Address, Hex } from 'viem';

import { erc20Iface } from './erc20';

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
      console.warn(`Failed to load from Address Book for chain ${chainId}:`, error);
    }
  }

  throw new Error(
    `Unsupported chain: ${chainId}. Supported chains: ${[
      ...Object.keys(CHAIN_TO_AAVE_ADDRESS_BOOK),
    ].join(', ')}`,
  );
}

/**
 * Get available markets (asset addresses) for a specific chain using the Aave Address Book
 */
function getAvailableMarkets(chainId: number): Record<string, Address> {
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
      console.warn(`Failed to load markets from Address Book for ${chainId}:`, error);
    }
  }

  throw new Error(
    `No markets available for chain: ${chainId}. Supported chains: ${[
      ...Object.keys(CHAIN_TO_AAVE_ADDRESS_BOOK),
    ].join(', ')}`,
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
  amount = String(Math.floor(Math.random() * 1000)),
): Promise<Transaction> {
  const approveData = erc20Iface.encodeFunctionData('approve', [poolAddress, amount]) as Hex;
  const approveTx: Transaction = {
    data: approveData,
    from: accountAddress,
    to: assetAddress,
  };

  return approveTx;
}

export interface AaveApprovalTxParams {
  accountAddress: Address;
  chainId: number;
}

export async function getAaveApprovalTx({
  accountAddress,
  chainId,
}: AaveApprovalTxParams) {
  const { POOL } = getAaveAddresses(chainId);

  const markets = getAvailableMarkets(chainId);
  const asset = markets['USDC'];
  if (!asset) {
    throw new Error(`USDC not found in Aave markets for chain ${chainId}`);
  }

  return await buildApprovalTx(accountAddress, asset, POOL);
}
