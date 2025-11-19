import { createZeroDevPaymasterClient } from '@zerodev/sdk';
import { KERNEL_V3_3, getEntryPoint } from '@zerodev/sdk/constants';
import { http } from 'viem';

import { chain } from './base';

const ZERODEV_RPC_URL = process.env.ZERODEV_RPC_URL as string | undefined;
if (!ZERODEV_RPC_URL) {
  throw new Error('Missing ZERODEV_RPC_URL env variable');
}

export const kernelVersion = KERNEL_V3_3;
export const entryPoint = getEntryPoint('0.7');
export const zerodevRpc = ZERODEV_RPC_URL;
export const zerodevTransport = http(zerodevRpc);

export const zerodevPaymaster = createZeroDevPaymasterClient({
  chain,
  transport: zerodevTransport,
});
