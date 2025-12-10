import { bundledVincentAbility } from '@lit-protocol/vincent-ability-aave-smart-account';
import type { PermissionData } from '@lit-protocol/vincent-contracts-sdk';
import type { VincentDevEnvironment } from '@lit-protocol/vincent-e2e-test-utils';
import { setupVincentDevelopmentEnvironment } from '@lit-protocol/vincent-e2e-test-utils';

/**
 * Simplified Vincent setup using the e2e-test-utils package.
 *
 * This function handles the complete Vincent + Smart Account setup:
 * - Checking and funding all required accounts (funder, app delegatee, app manager)
 * - Registering or updating your app with abilities and policies
 * - Creating or using an existing agent PKP
 * - Setting up permissions for the agent PKP
 * - Ensuring a valid capacity token exists
 * - Creating a smart account owned by agentWalletOwner with PKP as permitted signer
 *
 * Environment variables required:
 * - TEST_FUNDER_PRIVATE_KEY: Private key for the funder account
 * - TEST_APP_MANAGER_PRIVATE_KEY: Private key for the app manager account
 * - TEST_APP_DELEGATEE_PRIVATE_KEY: Private key for the app delegatee account
 * - TEST_AGENT_WALLET_PKP_OWNER_PRIVATE_KEY: Private key for the agent wallet PKP owner
 * - SMART_ACCOUNT_CHAIN_ID: Chain ID for smart account deployment
 * - YELLOWSTONE_RPC_URL (optional): Defaults to https://yellowstone-rpc.litprotocol.com/
 *
 * For ZeroDev: ZERODEV_RPC_URL
 * For Crossmint: CROSSMINT_API_KEY
 * For Safe: SAFE_RPC_URL, PIMLICO_RPC_URL
 */
export async function setupVincentDevelopment(
  smartAccountType: 'zerodev' | 'crossmint' | 'safe'
): Promise<VincentDevEnvironment> {

  // Create permission data for the Aave smart account ability
  // This grants the ability without any additional policies
  const permissionData: PermissionData = {
    [bundledVincentAbility.ipfsCid]: {},
  };

  try {
    return await setupVincentDevelopmentEnvironment({
      permissionData,
      smartAccountType,
    });

  } catch (error) {
    throw new Error(
      `Vincent setup failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
