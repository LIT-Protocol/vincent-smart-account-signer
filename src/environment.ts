import { LIT_RPC } from '@lit-protocol/constants';
import { bundledVincentAbility } from '@lit-protocol/vincent-ability-aave-smart-account';
import { getVincentAbilityClient } from '@lit-protocol/vincent-app-sdk/abilityClient';
import { createZeroDevPaymasterClient } from '@zerodev/sdk';
import { KERNEL_V3_3, getEntryPoint } from '@zerodev/sdk/constants';
import { ethers } from 'ethers';
import { Hex, http, createPublicClient } from 'viem';
import { baseSepolia } from 'viem/chains';

const DELEGATEE_PRIVATE_KEY = process.env.DELEGATEE_PRIVATE_KEY as Hex;

export const alchemyRpc = process.env.ALCHEMY_RPC_URL as string;
export const zerodevRpc = process.env.ZERODEV_RPC_URL as string;

export const chain = baseSepolia;

export const kernelVersion = KERNEL_V3_3;
export const entryPoint = getEntryPoint('0.7');

export const transport = http(zerodevRpc);

export const publicClient = createPublicClient({
  chain,
  transport,
});

export const zerodevPaymaster = createZeroDevPaymasterClient({
  chain,
  transport,
});

const yellowstoneProvider = new ethers.providers.JsonRpcProvider(LIT_RPC.CHRONICLE_YELLOWSTONE);
const delegateeSigner = new ethers.Wallet(
  DELEGATEE_PRIVATE_KEY,
  yellowstoneProvider,
);
export const abilityClient = getVincentAbilityClient({
  bundledVincentAbility,
  ethersSigner: delegateeSigner,
});
