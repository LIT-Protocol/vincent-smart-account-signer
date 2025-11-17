import { createZeroDevPaymasterClient } from '@zerodev/sdk';
import { KERNEL_V3_3, getEntryPoint } from '@zerodev/sdk/constants';

import { chain, transport } from './base';

export const kernelVersion = KERNEL_V3_3;
export const entryPoint = getEntryPoint('0.7');

export const zerodevPaymaster = createZeroDevPaymasterClient({
  chain,
  transport,
});
