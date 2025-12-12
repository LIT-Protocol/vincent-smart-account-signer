import { Hex, WalletClient, http, createPublicClient, createWalletClient } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const ALCHEMY_RPC_URL = process.env.ALCHEMY_RPC_URL as string | undefined;
if (!ALCHEMY_RPC_URL) {
  throw new Error('Missing ALCHEMY_RPC_URL env variable');
}
export const alchemyRpc = ALCHEMY_RPC_URL;

export const chain = baseSepolia;

export const transport = http(alchemyRpc);

export const publicClient = createPublicClient({
  chain,
  transport,
});

const fundsProviderPrivateKey = process.env.FUNDS_PROVIDER_PRIVATE_KEY as
  | Hex
  | undefined;
export const fundsProviderWalletClient: WalletClient | undefined = fundsProviderPrivateKey
  ? createWalletClient({
    chain,
    transport,
    account: privateKeyToAccount(fundsProviderPrivateKey),
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
export const ownerPrivateKey = OWNER_PRIVATE_KEY || generatedOwnerPrivateKey;
export const ownerAccount = privateKeyToAccount(ownerPrivateKey);
