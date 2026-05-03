export const FX_BOOK = 'usd_mxn';

export function resolveBook(coin: string): string {
  const normalized = coin.toLowerCase();
  // Accept either a bare coin (btc → btc_usd) or a full book (btc_usd → btc_usd)
  return normalized.includes('_') ? normalized : `${normalized}_usd`;
}
