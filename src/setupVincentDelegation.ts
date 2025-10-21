import { LitActionResource, LitPKPResource } from '@lit-protocol/auth-helpers';
import { datil } from '@lit-protocol/contracts';
import { LitContracts } from '@lit-protocol/contracts-sdk';
import {
  AUTH_METHOD_SCOPE,
  LIT_ABILITY,
  LIT_NETWORK,
} from '@lit-protocol/constants';
import { EthWalletProvider, LitRelay } from '@lit-protocol/lit-auth-client';
import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { PKPEthersWallet } from '@lit-protocol/pkp-ethers';
import {
  AuthMethod,
  IRelayPKP,
  IRelayPollStatusResponse,
  LIT_NETWORKS_KEYS,
} from '@lit-protocol/types';
import {
  type PermissionData,
  getClient,
} from '@lit-protocol/vincent-contracts-sdk';
import bs58 from 'bs58';
import { ethers } from 'ethers';
import { Hex } from 'viem';
import { PrivateKeyAccount } from 'viem/accounts';

import {
  litPayerSecretKey,
  litRelayApiKey,
  pkpEthAddress,
  yellowstoneProvider,
} from './environment';

type SerializedBigNumber = {
  hex: string;
  type: 'BigNumber';
};

const SELECTED_LIT_NETWORK = LIT_NETWORK.Datil as LIT_NETWORKS_KEYS;
const DOMAIN = 'dashboard.heyvincent.ai';
const ORIGIN = 'https://dashboard.heyvincent.ai';

/**
 * Add PKP to payer's allowed list for free capacity credits
 */
async function addPayee(ethAddress: string): Promise<void> {
  console.log(`   📋 Registering PKP with payer for free capacity credits...`);

  if (!litRelayApiKey || !litPayerSecretKey) {
    console.warn(
      '   ⚠️  litRelayApiKey or litPayerSecretKey not provided, skipping payee registration'
    );
    return;
  }

  console.log(`   📋 litRelayApiKey: ${litRelayApiKey}`);
  console.log(`   📋 litPayerSecretKey: ${litPayerSecretKey}`);

  try {
    const headers = {
      'api-key': litRelayApiKey,
      'payer-secret-key': litPayerSecretKey,
      'Content-Type': 'application/json',
    };

    const response = await fetch('https://datil-relayer.getlit.dev/add-users', {
      method: 'POST',
      headers,
      body: JSON.stringify([ethAddress]),
    });

    if (!response.ok) {
      throw new Error(`Failed to add payee: ${await response.text()}`);
    }

    const data = await response.json();
    if (data.success !== true) {
      throw new Error(`Failed to add payee: ${data.error}`);
    }

    console.log(`   ✅ PKP registered with payer - no LIT tokens required!`);
  } catch (err) {
    console.warn(
      '   ⚠️  Failed to add payee (PKP may need LIT tokens for operations):',
      err
    );
  }
}

/**
 * Utility to convert hex IPFS CID to base58
 */
function hexToBase58(hexString: string): string | null {
  try {
    const cleaned = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
    if (
      !cleaned ||
      cleaned ===
        '0000000000000000000000000000000000000000000000000000000000000000'
    ) {
      return null;
    }
    const bytes = Buffer.from(cleaned, 'hex');
    return bs58.encode(bytes);
  } catch (error) {
    console.error('Error converting hex to base58:', error);
    return null;
  }
}

async function authenticateWithEOA(
  ownerAccount: PrivateKeyAccount,
  ethWalletProvider: EthWalletProvider
): Promise<{
  authMethod: AuthMethod;
}> {
  console.log(`   Address: ${ownerAccount.address}`);

  const signMessage = async (message: string): Promise<string> => {
    return await ownerAccount.signMessage({ message });
  };

  const authMethod = await ethWalletProvider.authenticate({
    address: ownerAccount.address,
    signMessage,
  });

  return { authMethod };
}

async function getOrMintUserPKP(
  authMethod: AuthMethod,
  ethWalletProvider: EthWalletProvider
): Promise<IRelayPKP> {
  const pkps = (await ethWalletProvider.fetchPKPsThroughRelayer(
    authMethod
  )) as unknown as (IRelayPKP & { tokenId: SerializedBigNumber })[];

  if (pkps.length === 0) {
    console.log('   No existing PKP found. Minting new PKP...');

    const options = {
      permittedAuthMethodScopes: [[AUTH_METHOD_SCOPE.SignAnything]],
    };

    // Mint PKP through relay server
    const txHash = await ethWalletProvider.mintPKPThroughRelayer(
      authMethod,
      options
    );
    const response =
      await ethWalletProvider.relay.pollRequestUntilTerminalState(txHash);

    if (
      response.status !== 'Succeeded' ||
      !response.pkpTokenId ||
      !response.pkpPublicKey ||
      !response.pkpEthAddress
    ) {
      throw new Error('PKP minting failed');
    }

    const userPKP: IRelayPKP = {
      tokenId: response.pkpTokenId,
      publicKey: response.pkpPublicKey,
      ethAddress: response.pkpEthAddress,
    };

    console.log(`✅ User PKP minted successfully`);
    console.log(`   Token ID: ${userPKP.tokenId}`);
    console.log(`   Address: ${userPKP.ethAddress}`);

    // Add PKP to payer's list for free capacity credits
    await addPayee(userPKP.ethAddress);

    return userPKP;
  } else {
    const userPKP = pkps[0];
    console.log(`✅ Found existing user PKP`);
    console.log(`   Token ID: ${userPKP.tokenId}`);
    console.log(`   Address: ${userPKP.ethAddress}`);

    await addPayee(userPKP.ethAddress);

    return {
      ...userPKP,
      tokenId: userPKP.tokenId.hex,
    };
  }
}

async function getSessionSigs(
  pkpPublicKey: string,
  authMethod: AuthMethod,
  litNodeClient: LitNodeClient
) {
  const sessionSigs = await litNodeClient.getPkpSessionSigs({
    chain: 'ethereum',
    expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 1 day
    pkpPublicKey,
    authMethods: [authMethod],
    resourceAbilityRequests: [
      {
        resource: new LitActionResource('*'),
        ability: LIT_ABILITY.LitActionExecution,
      },
      {
        resource: new LitPKPResource('*'),
        ability: LIT_ABILITY.PKPSigning,
      },
    ],
  });

  return sessionSigs;
}

function getContractFromJsSdk(
  network: string,
  contractName: string,
  provider: ethers.providers.JsonRpcProvider
) {
  let contractsDataRes;
  switch (network) {
    case 'datil':
      contractsDataRes = datil;
      break;
    default:
      throw new Error(`Unsupported network: ${network}`);
  }

  const contractList = contractsDataRes.data as any;
  const contractData = contractList.find(
    (contract: any) => contract.name === contractName
  );

  if (!contractData) {
    throw new Error(`No contract found with name ${contractName}`);
  }

  const contract = contractData.contracts[0];
  return new ethers.Contract(contract.address_hash, contract.ABI, provider);
}

export function getPkpNftContract(network: LIT_NETWORKS_KEYS) {
  return getContractFromJsSdk(network, 'PKPNFT', yellowstoneProvider);
}

/**
 * Mint agent PKP controlled by user PKP
 */
async function mintAgentPKP(userPKP: IRelayPKP): Promise<IRelayPKP> {
  console.log('\n🤖 Minting agent PKP...');

  if (!litRelayApiKey) {
    throw new Error('litRelayApiKey is required to mint agent PKP');
  }

  const requestBody = {
    keyType: '2',
    permittedAuthMethodTypes: ['2'], // PKP type
    permittedAuthMethodIds: [userPKP.tokenId],
    permittedAuthMethodPubkeys: ['0x'],
    permittedAuthMethodScopes: [['1']], // Sign anything scope
    addPkpEthAddressAsPermittedAddress: true,
    sendPkpToItself: false,
    burnPkp: false,
    sendToAddressAfterMinting: userPKP.ethAddress,
  };

  const response = await fetch(
    'https://datil-relayer.getlit.dev/mint-next-and-add-auth-methods',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': litRelayApiKey,
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to mint agent PKP: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const responseJson = await response.json();

  const txReceipt = await yellowstoneProvider.waitForTransaction(
    responseJson.requestId
  );
  if (txReceipt.status !== 1) {
    throw new Error(`Transaction failed with status: ${txReceipt.status}`);
  }

  const pkpNftContract = getPkpNftContract(SELECTED_LIT_NETWORK);

  // Find PKPMinted event
  const mintEvent = txReceipt.logs.find((log) => {
    try {
      const parsed = pkpNftContract.interface.parseLog(log);
      return parsed.name === 'PKPMinted';
    } catch {
      return false;
    }
  });

  if (!mintEvent) {
    throw new Error('PKPMinted event not found in transaction logs');
  }

  const parsed = pkpNftContract.interface.parseLog(mintEvent);
  const tokenId = parsed.args.tokenId;
  const publicKey = await pkpNftContract.getPubkey(tokenId);
  const ethAddress = ethers.utils.computeAddress(publicKey);

  const agentPKP: IRelayPKP = {
    tokenId: tokenId.toString(),
    publicKey,
    ethAddress,
  };

  console.log('✅ Agent PKP minted successfully');
  console.log(`   Token ID: ${agentPKP.tokenId}`);
  console.log(`   Address: ${agentPKP.ethAddress}`);

  // Add agent PKP to payer's list for free capacity credits
  await addPayee(agentPKP.ethAddress);

  return agentPKP;
}

async function fetchAppInfo(appId: number): Promise<{
  app: any;
  abilities: string[];
}> {
  const registryUrl = 'https://registry.heyvincent.ai';

  try {
    const appResponse = await fetch(`${registryUrl}/app/${appId}`);
    if (!appResponse.ok) {
      throw new Error(`Failed to fetch app: ${appResponse.statusText}`);
    }
    const app = await appResponse.json();

    console.log(`✅ App found: ${app.name}`);
    console.log(`   Active version: ${app.activeVersion}`);

    const abilitiesResponse = await fetch(
      `${registryUrl}/app/${appId}/version/${app.activeVersion}/abilities`
    );
    if (!abilitiesResponse.ok) {
      throw new Error(
        `Failed to fetch abilities: ${abilitiesResponse.statusText}`
      );
    }
    const abilitiesData = await abilitiesResponse.json();

    const abilities: string[] = [];
    for (const ability of abilitiesData) {
      const abilityVersionResponse = await fetch(
        `${registryUrl}/ability/${encodeURIComponent(
          ability.abilityPackageName
        )}/version/${ability.abilityVersion}`
      );
      if (abilityVersionResponse.ok) {
        const abilityVersion = await abilityVersionResponse.json();
        if (abilityVersion.ipfsCid) {
          abilities.push(abilityVersion.ipfsCid);
          console.log(
            `   Ability: ${ability.abilityPackageName}@${ability.abilityVersion}`
          );
          console.log(`   IPFS CID: ${abilityVersion.ipfsCid}`);
        }
      }
    }

    return { app, abilities };
  } catch (error) {
    throw new Error(
      `Failed to fetch app info: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

async function addPermittedActions(
  userPkpWallet: PKPEthersWallet,
  agentPKPTokenId: string,
  abilityIpfsCids: string[]
): Promise<void> {
  const litContracts = new LitContracts({
    network: SELECTED_LIT_NETWORK,
    signer: userPkpWallet,
  });
  await litContracts.connect();

  const permittedActions =
    await litContracts.pkpPermissionsContractUtils.read.getPermittedActions(
      agentPKPTokenId
    );

  const permittedActionSet = new Set(
    permittedActions.map((cid: string) => hexToBase58(cid)).filter(Boolean)
  );

  for (const ipfsCid of abilityIpfsCids) {
    if (!permittedActionSet.has(ipfsCid)) {
      console.log(`   Adding permission for: ${ipfsCid}`);
      await litContracts.addPermittedAction({
        ipfsId: ipfsCid,
        pkpTokenId: agentPKPTokenId,
        authMethodScopes: [AUTH_METHOD_SCOPE.SignAnything],
      });
      console.log(`   ✅ Permission added`);
    } else {
      console.log(`   ⏭️  Already permitted: ${ipfsCid}`);
    }
  }
}

async function permitApp(
  userPkpWallet: PKPEthersWallet,
  agentPKP: IRelayPKP,
  appId: number,
  appVersion: number,
  permissionData: PermissionData
): Promise<string> {
  const client = getClient({ signer: userPkpWallet });

  const result = await client.permitApp({
    pkpEthAddress: agentPKP.ethAddress,
    appId: appId,
    appVersion: appVersion,
    permissionData: permissionData,
  });

  console.log(`✅ App permitted successfully`);
  console.log(`   Transaction: ${result.txHash}`);

  return result.txHash;
}

export interface SetupVincentDelegationParams {
  ownerAccount: PrivateKeyAccount;
  vincentAppId: number | undefined;
}

export async function setupVincentDelegation({
  ownerAccount,
  vincentAppId,
}: SetupVincentDelegationParams): Promise<Hex> {
  // If PKP address is already provided, skip the setup and use that one
  if (pkpEthAddress) {
    console.log(`✅ Using existing PKP address: ${pkpEthAddress}`);
    return pkpEthAddress;
  }

  // If no PKP address is provided, ensure we have the required env variables
  if (!vincentAppId || !litRelayApiKey || !litPayerSecretKey) {
    throw new Error(
      'Cannot setup Vincent delegation without vincentAppId, litRelayApiKey and litPayerSecretKey'
    );
  }

  console.log('\n🚀 Vincent Account Delegation Setup');
  console.log('=====================================\n');

  const litNodeClient = new LitNodeClient({
    alertWhenUnauthorized: false,
    litNetwork: SELECTED_LIT_NETWORK,
    debug: false,
  });
  await litNodeClient.connect();

  const litRelay = new LitRelay({
    relayUrl: LitRelay.getRelayUrl(SELECTED_LIT_NETWORK),
    relayApiKey: litRelayApiKey,
  });

  const ethWalletProvider = new EthWalletProvider({
    relay: litRelay,
    litNodeClient,
    domain: DOMAIN,
    origin: ORIGIN,
  });

  try {
    const { authMethod } = await authenticateWithEOA(
      ownerAccount,
      ethWalletProvider
    );

    const userPKP = await getOrMintUserPKP(authMethod, ethWalletProvider);

    const sessionSigs = await getSessionSigs(
      userPKP.publicKey,
      authMethod,
      litNodeClient
    );

    console.log('\n💼 Creating user PKP wallet...');
    const userPkpWallet = new PKPEthersWallet({
      controllerSessionSigs: sessionSigs,
      pkpPubKey: userPKP.publicKey,
      litNodeClient: litNodeClient,
    });
    await userPkpWallet.init();
    console.log('✅ User PKP wallet ready');

    const { app, abilities } = await fetchAppInfo(vincentAppId);
    if (abilities.length === 0) {
      throw new Error('No abilities found for this app');
    }

    const agentPKP = await mintAgentPKP(userPKP);
    await addPermittedActions(userPkpWallet, agentPKP.tokenId, abilities);

    // Create default permission data (all abilities, no policies)
    const permissionData: PermissionData = {};
    abilities.forEach((ipfsCid) => {
      permissionData[ipfsCid] = {};
    });
    await permitApp(
      userPkpWallet,
      agentPKP,
      vincentAppId,
      app.activeVersion,
      permissionData
    );

    console.log('\n🎉 SUCCESS! Vincent delegation setup complete');
    console.log('==========================================');
    console.log('\n📊 Summary:');
    console.log(`   EOA Address: ${ownerAccount.address}`);
    console.log(`   User PKP Address: ${userPKP.ethAddress}`);
    console.log(`   Agent PKP Address: ${agentPKP.ethAddress}`);
    console.log(`   App ID: ${vincentAppId}`);
    console.log(`   App Name: ${app.name}`);
    console.log(`   App Version: ${app.activeVersion}`);
    console.log(`   Abilities Granted: ${abilities.length}`);

    console.log('\n💡 Your agent PKP can now be used with the app!');

    await litNodeClient.disconnect();

    return agentPKP.ethAddress as Hex;
  } catch (error) {
    throw new Error(
      `Vincent delegation setup failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
