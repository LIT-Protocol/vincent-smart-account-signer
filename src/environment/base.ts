import { Hex, WalletClient, http, createPublicClient, createWalletClient } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

export const alchemyRpc = process.env.ALCHEMY_RPC_URL as string;
export const zerodevRpc = process.env.ZERODEV_RPC_URL as string;

export const chain = baseSepolia;

export const transport = http(zerodevRpc);

export const publicClient = createPublicClient({
  chain,
  transport,
});

const aaveUsdcProviderPrivateKey = process.env.AAVE_USDC_PRIVATE_KEY as
  | Hex
  | undefined;
export const aaveUsdcProviderWalletClient: WalletClient | undefined = aaveUsdcProviderPrivateKey
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
