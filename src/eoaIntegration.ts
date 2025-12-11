import { toVincentTransaction, Transaction } from '@lit-protocol/vincent-ability-aave';
import { disconnectVincentAbilityClients } from '@lit-protocol/vincent-app-sdk/abilityClient';
import {
  Address, Hex,
  parseUnits,
  parseSignature,
  serializeTransaction,
} from 'viem';

import { alchemyRpc, ownerAccount, publicClient } from './environment/base';
import { abilityClient, vincentAppId } from './environment/lit';
import {
  generateSupplyTransactions,
  generateWithdrawTransactions,
} from './utils/generateTransactions';
import { fundAccount } from './utils/fundAccount';
import { setupVincentDelegation } from './utils/setupVincentDelegation';

interface SendTransactionsParams {
  accountAddress: Address;
  transactions: Transaction[];
}

async function sendPkpTransactions({
  accountAddress, transactions,
}: SendTransactionsParams) {
  const vincentDelegationContext = {
    delegatorPkpEthAddress: accountAddress,
  };

  for (const [index, transaction] of transactions.entries()) {
    console.log(
      `\n📝 Processing transaction ${index + 1}/${transactions.length}`
    );
    console.log(`   → To: ${transaction.to}`);

    const transactionRequest = await publicClient.prepareTransactionRequest({
      account: accountAddress,
      from: accountAddress,
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
}

async function main() {
  const pkpEthAddress = await setupVincentDelegation({
    ownerAccount,
    vincentAppId,
  });

  await fundAccount({
    accountAddress: pkpEthAddress,
    // We cannot estimate gas without any funds, so we use a default value
    nativeFunds: parseUnits('0.0001', 18),
  });

  // First we supply to Aave
  const supplyTransactions = await generateSupplyTransactions({
    accountAddress: pkpEthAddress,
  });
  await sendPkpTransactions({
    accountAddress: pkpEthAddress,
    transactions: supplyTransactions,
  });

  // Then we withdraw from aave
  const withdrawTransactions = await generateWithdrawTransactions({
    accountAddress: pkpEthAddress,
  });
  await sendPkpTransactions({
    accountAddress: pkpEthAddress,
    transactions: withdrawTransactions,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectVincentAbilityClients();

    console.log('Success! Transactions sent and executed successfully.');
    process.exit(0);
  });
