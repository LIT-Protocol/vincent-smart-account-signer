import { createSmartAccountClient } from 'permissionless';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { Address, http } from 'viem';
import { entryPoint07Address } from 'viem/account-abstraction';

import { chain } from './base';

export const safe4337ModuleAddress =
  '0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226' as Address;

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
