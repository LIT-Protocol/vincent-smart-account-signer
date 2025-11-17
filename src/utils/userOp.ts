import { Address, Hex, isHex, toHex } from 'viem';

export interface UserOp {
  callData: Hex;
  callGasLimit: bigint | Hex;
  factory?: Address;
  factoryData?: Hex;
  maxFeePerGas: bigint | Hex;
  maxPriorityFeePerGas: bigint | Hex;
  nonce: bigint | Hex;
  paymaster?: Address;
  paymasterData?: Hex;
  paymasterPostOpGasLimit?: bigint | Hex;
  paymasterVerificationGasLimit?: bigint | Hex;
  preVerificationGas: bigint | Hex;
  signature: Hex;
  verificationGasLimit: bigint | Hex;
}

export interface VincentUserOp extends UserOp {
  callGasLimit: Hex;
  maxFeePerGas: Hex;
  maxPriorityFeePerGas: Hex;
  nonce: Hex;
  paymasterPostOpGasLimit?: Hex;
  paymasterVerificationGasLimit?: Hex;
  preVerificationGas: Hex;
  verificationGasLimit: Hex;
}

const hexValues = [
  'callGasLimit',
  'maxFeePerGas',
  'maxPriorityFeePerGas',
  'nonce',
  'paymasterPostOpGasLimit',
  'paymasterVerificationGasLimit',
  'preVerificationGas',
  'verificationGasLimit',
] as const;

export function userOp(userOp: UserOp): VincentUserOp {
  const _userOp = { ...userOp };

  for (const key of hexValues) {
    if (hexValues.includes(key) && _userOp[key] && !isHex(_userOp[key])) {
      _userOp[key] = toHex(_userOp[key]);
    }
  }

  return _userOp as VincentUserOp;
}
