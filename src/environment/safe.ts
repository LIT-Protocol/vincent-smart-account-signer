import { createSmartAccountClient } from 'permissionless';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { http } from 'viem';
import { entryPoint07Address } from 'viem/account-abstraction';

import { chain } from './base';

const PIMLICO_RPC_URL = process.env.PIMLICO_RPC_URL as string | undefined;
if (!PIMLICO_RPC_URL) {
  throw new Error('Missing PIMLICO_RPC_URL env variable');
}

export const safeVersion = '1.4.1';
export const entryPoint = {
  address: entryPoint07Address,
  version: '0.7',
} as const;
export const pimlicoRpc = PIMLICO_RPC_URL;
export const pimlicoTransport = http(pimlicoRpc);

export const smartAccountClient = createSmartAccountClient({
  chain,
  bundlerTransport: pimlicoTransport,
});

export const pimlicoClient = createPimlicoClient({
  entryPoint,
  transport: pimlicoTransport,
});
