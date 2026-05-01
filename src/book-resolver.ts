const COIN_TO_BOOK: Record<string, string> = {
  btc: 'btc_usd',
  eth: 'eth_usd',
  sol: 'sol_usd',
};

export const SUPPORTED_COINS = Object.keys(COIN_TO_BOOK);

export const FX_BOOK = 'usd_mxn';

export function resolveBook(coin: string): string {
  const normalized = coin.toLowerCase();
  const book = COIN_TO_BOOK[normalized];
  if (!book) {
    throw new Error(`Unknown coin: ${coin}. Supported: ${SUPPORTED_COINS.join(', ')}`);
  }
  return book;
}
