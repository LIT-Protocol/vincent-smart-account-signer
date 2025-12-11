import {
  formatSafeSignature,
  safeEip712Params,
  toVincentUserOp,
} from '@lit-protocol/vincent-ability-aave';
import { Address, Hex } from 'viem';

import { alchemyRpc } from '../environment/base';
import { abilityClient } from '../environment/lit';
import { entryPoint, safe4337ModuleAddress } from '../environment/safe';

interface GetSafeUserOperationSignatureParams {
  pkpAddress: Address;
  userOp: any;
}

export async function getSafeUserOperationSignature({
  pkpAddress,
  userOp,
}: GetSafeUserOperationSignatureParams) {
  console.log(`Sending user op to the Lit Signer...`);

  const vincentDelegationContext = {
    delegatorPkpEthAddress: pkpAddress,
  };
  const validAfter = 0;
  const validUntil = 0;
  const vincentAbilityParams = {
    safe4337ModuleAddress,
    validAfter,
    validUntil,
    alchemyRpcUrl: alchemyRpc,
    eip712Params: safeEip712Params,
    entryPointAddress: entryPoint.address,
    userOp: toVincentUserOp(userOp),
  };

  const precheckResult = await abilityClient.precheck(
    vincentAbilityParams,
    vincentDelegationContext
  );
  if (!precheckResult.success) {
    throw new Error(`Precheck failed: ${JSON.stringify(precheckResult)}`);
  }

  const executeResult = await abilityClient.execute(
    vincentAbilityParams,
    vincentDelegationContext
  );
  if (!executeResult.success) {
    throw new Error(`Execute failed: ${JSON.stringify(executeResult)}`);
  }

  // Safe signatures have the following shape [validAfter (6 bytes)][validUntil (6 bytes)][sig (ECDSA)][maybe-module]
  return formatSafeSignature({
    validAfter,
    validUntil,
    signature: executeResult.result.signature as Hex,
  });
}
