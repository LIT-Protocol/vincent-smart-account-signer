import { type UserOperation } from '@zerodev/sdk';
import { toHex } from 'viem';

export function serializeUserOpForVincent(aaveUserOp: UserOperation) {
  return {
    ...aaveUserOp,
    maxFeePerGas: toHex(aaveUserOp.maxFeePerGas),
    maxPriorityFeePerGas: toHex(aaveUserOp.maxPriorityFeePerGas),
    nonce: toHex(aaveUserOp.nonce),
    callGasLimit: toHex(aaveUserOp.callGasLimit),
    verificationGasLimit: toHex(aaveUserOp.verificationGasLimit),
    preVerificationGas: toHex(aaveUserOp.preVerificationGas),
    paymasterVerificationGasLimit: toHex(
      aaveUserOp.paymasterVerificationGasLimit
    ),
    paymasterPostOpGasLimit: toHex(aaveUserOp.paymasterPostOpGasLimit),
  };
}
