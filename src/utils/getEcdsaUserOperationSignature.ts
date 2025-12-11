import { toVincentUserOp } from '@lit-protocol/vincent-ability-aave';
import { Address, Hex } from 'viem';
import { entryPoint07Address } from 'viem/account-abstraction';

import { alchemyRpc } from '../environment/base';
import { abilityClient } from '../environment/lit';

interface GetEcdsaUserOperationSignatureParams {
  pkpAddress: Address;
  userOp: any;
}

export async function getEcdsaUserOperationSignature({
  pkpAddress,
  userOp,
}: GetEcdsaUserOperationSignatureParams) {
  console.log(`Sending user op to the Lit Signer...`);

  const vincentDelegationContext = {
    delegatorPkpEthAddress: pkpAddress,
  };
  const vincentAbilityParams = {
    alchemyRpcUrl: alchemyRpc,
    entryPointAddress: entryPoint07Address,
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

  return executeResult.result.signature as Hex;
}
