import { type Address, type Hex } from 'viem';
import { toAccount } from 'viem/accounts';

export interface AddressToAccountParams {
  address: Address;
}

export function addressToAccount({ address }: AddressToAccountParams) {
  return toAccount({
    address,

    // Return dummy signatures for estimation/building
    async signMessage() {
      return ('0x' + '00'.repeat(65)) as Hex;
    },
    async signTypedData() {
      return ('0x' + '00'.repeat(65)) as Hex;
    },
    async signTransaction() {
      return ('0x' + '00'.repeat(65)) as Hex;
    },
  });
}
