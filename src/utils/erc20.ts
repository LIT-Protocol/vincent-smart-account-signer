import { type Abi, type Address, getContract, type WalletClient } from 'viem';

import { publicClient } from '../environment/base';

/**
 * ERC20 Token ABI - Essential methods only
 */
export const ERC20_ABI: Abi = [
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export const getErc20ReadContract = (address: Address) =>
  getContract({
    address,
    abi: ERC20_ABI,
    client: publicClient,
  });

export const getErc20WriteContract = (address: Address, walletClient: WalletClient) =>
  getContract({
    address,
    abi: ERC20_ABI,
    client: { public: publicClient, wallet: walletClient },
  });

/**
 * Get the number of decimals for an ERC20 token
 * @param tokenAddress The address of the ERC20 token
 * @returns The number of decimals for the token
 */
export async function getERC20Decimals(tokenAddress: Address) {
  const contract = getErc20ReadContract(tokenAddress);

  return (await contract.read.decimals()) as number;
}
