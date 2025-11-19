import { disconnectVincentAbilityClients } from '@lit-protocol/vincent-app-sdk/abilityClient';
import { toVincentTransaction } from '@lit-protocol/vincent-ability-aave-smart-account';
import { Address, Hex, parseUnits, parseSignature, serializeTransaction } from 'viem';

import { alchemyRpc, ownerAccount, publicClient } from './environment/base';
import { abilityClient, vincentAppId } from './environment/lit';
import { generateTransactions } from './utils/generateTransactions';
import { fundAccount } from './utils/fundAccount';
import { setupVincentDelegation } from './utils/setupVincentDelegation';

async function main() {
  const pkpEthAddress = await setupVincentDelegation({
    ownerAccount,
    vincentAppId,
  });

  await fundAccount({
    accountAddress: pkpEthAddress as Address,
    // We cannot estimate gas without any funds, so we use a default value
    nativeFunds: parseUnits('0.0001', 18),
  });

  const transactions = await generateTransactions({
    accountAddress: pkpEthAddress as Address,
  });

  const vincentDelegationContext = {
    delegatorPkpEthAddress: pkpEthAddress,
  };

  for (const [index, transaction] of transactions.entries()) {
    console.log(
      `\n📝 Processing transaction ${index + 1}/${transactions.length}`
    );
    console.log(`   → To: ${transaction.to}`);

    const transactionRequest = await publicClient.prepareTransactionRequest({
      account: pkpEthAddress,
      from: pkpEthAddress,
      data: transaction.data,
      to: transaction.to,
      value: BigInt(transaction.value),
    });

    const vincentAbilityParams = {
      alchemyRpcUrl: alchemyRpc,
      transaction: toVincentTransaction(transactionRequest),
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

    const signature = executeResult.result.signature as Hex;
    if (!signature) {
      throw new Error(
        'Vincent ability did not return the transaction signature. Please ensure the ability version supports EOA signing and you are calling it correctly.'
      );
    }

    const serializedTransaction = serializeTransaction(
      transactionRequest as any,
      parseSignature(signature)
    );

    console.log('   🚀 Broadcasting transaction...');
    const txHash = await publicClient.sendRawTransaction({
      serializedTransaction,
    });

    await publicClient.waitForTransactionReceipt({
      confirmations: 2,
      hash: txHash,
    });
    console.log(`   ✅ Transaction confirmed at hash ${txHash}`);
  }

  await disconnectVincentAbilityClients();

  console.log(
    '\n🎉 Success! All transactions signed and broadcasted for the Vincent PKP.'
  );
  process.exit(0);
}

main().catch(async (error) => {
  console.error(error);
  await disconnectVincentAbilityClients().catch(() => undefined);
  process.exit(1);
});
