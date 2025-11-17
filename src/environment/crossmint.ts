import { createCrossmint, WalletsApiClient } from '@crossmint/wallets-sdk';

const crossmint = createCrossmint({
  apiKey: process.env.CROSSMINT_API_KEY as string,
});
export const crossmintWalletApiClient = new WalletsApiClient(crossmint);
