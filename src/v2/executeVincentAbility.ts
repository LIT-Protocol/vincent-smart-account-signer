import type { VincentAbilityClient } from '@lit-protocol/vincent-app-sdk/abilityClient';
import { Hex } from 'viem';

export interface ExecuteVincentAbilityParams {
  abilityClient: VincentAbilityClient<any, any>;
  vincentAbilityParams: any;
  delegatorPkpEthAddress: Hex;
}

export async function executeVincentAbility({
  abilityClient,
  vincentAbilityParams,
  delegatorPkpEthAddress,
}: ExecuteVincentAbilityParams) {
  const vincentDelegationContext = {
    delegatorPkpEthAddress,
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

  const result = (executeResult as any).result;
  if (!result) {
    throw new Error('Execute succeeded but result is undefined');
  }

  return result.signature as Hex;
}
