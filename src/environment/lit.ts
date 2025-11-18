import { LIT_RPC } from '@lit-protocol/constants';
import { bundledVincentAbility } from '@lit-protocol/vincent-ability-aave-smart-account';
import { getVincentAbilityClient } from '@lit-protocol/vincent-app-sdk/abilityClient';
import { ethers } from 'ethers';
import { Hex } from 'viem';

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
  debug: false,
}) as any;
