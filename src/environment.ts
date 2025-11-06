import { LIT_RPC } from '@lit-protocol/constants';
import { bundledVincentAbility } from '@lit-protocol/vincent-ability-aave-smart-account';
import {
  getVincentAbilityClient,
  type VincentAbilityClient,
} from '@lit-protocol/vincent-app-sdk/abilityClient';
import { createZeroDevPaymasterClient } from '@zerodev/sdk';
import { KERNEL_V3_3, getEntryPoint } from '@zerodev/sdk/constants';
import { ethers } from 'ethers';
import { Hex, http, createPublicClient, createWalletClient } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const DELEGATEE_PRIVATE_KEY = process.env.DELEGATEE_PRIVATE_KEY as Hex;
if (!DELEGATEE_PRIVATE_KEY) {
  throw new Error('Missing DELEGATEE_PRIVATE_KEY env variable');
}

// Option 1: provide the PKP address
const PKP_ETH_ADDRESS = process.env.PKP_ETH_ADDRESS;
// Option 2: provide the Vincent App ID, and relayer keys to generate the PKP address
const VINCENT_APP_ID = process.env.VINCENT_APP_ID;
const LIT_PAYER_SECRET_KEY = process.env.LIT_PAYER_SECRET_KEY;
const LIT_RELAY_API_KEY = process.env.LIT_RELAY_API_KEY;
if (
  !PKP_ETH_ADDRESS &&
  (!VINCENT_APP_ID || !LIT_PAYER_SECRET_KEY || !LIT_RELAY_API_KEY)
) {
  throw new Error(
    'Missing PKP_ETH_ADDRESS or VINCENT_APP_ID or LIT_PAYER_SECRET_KEY or LIT_RELAY_API_KEY env variable'
  );
}

export const pkpEthAddress = PKP_ETH_ADDRESS as Hex | undefined;
export const vincentAppId = VINCENT_APP_ID
  ? parseInt(VINCENT_APP_ID)
  : undefined;
export const litPayerSecretKey = LIT_PAYER_SECRET_KEY;
export const litRelayApiKey = LIT_RELAY_API_KEY;

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

const aaveUsdcProviderPrivateKey = process.env.AAVE_USDC_PRIVATE_KEY as
  | Hex
  | undefined;
export const aaveUsdcProviderWalletClient = aaveUsdcProviderPrivateKey
  ? createWalletClient({
      chain,
      transport,
      account: privateKeyToAccount(aaveUsdcProviderPrivateKey),
    })
  : undefined;

const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY as Hex | undefined;
const generatedOwnerPrivateKey = generatePrivateKey();
if (!OWNER_PRIVATE_KEY) {
  console.log(`Generated owner private key: ${generatedOwnerPrivateKey}`);
  console.log(
    `Please set OWNER_PRIVATE_KEY env variable to this value to keep using this account`
  );
}
export const ownerAccount = privateKeyToAccount(
  OWNER_PRIVATE_KEY || generatedOwnerPrivateKey
);

export const yellowstoneProvider = new ethers.providers.JsonRpcProvider(
  LIT_RPC.CHRONICLE_YELLOWSTONE
);
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Type instantiation is excessively deep due to zod schema types in vincent-app-sdk
const delegateeSigner = new ethers.Wallet(
  DELEGATEE_PRIVATE_KEY,
  yellowstoneProvider
);

// Type assertion to avoid deep type instantiation issues with zod types
// The type inference fails due to complex generic types from zod schemas in the vincent-app-sdk
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Type instantiation is excessively deep due to zod schema types
export const abilityClient = getVincentAbilityClient({
  bundledVincentAbility,
  ethersSigner: delegateeSigner,
}) as any;
