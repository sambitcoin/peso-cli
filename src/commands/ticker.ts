import { type Command } from 'commander';
import { PublicHttpClient, BitsoApiError } from '../http-public.js';
import { resolveBook, FX_BOOK } from '../book-resolver.js';
import { JsonOutput, TableOutput, printError } from '../output.js';
import type { TickerResult, FxInfo } from '../types.js';

export function registerTickerCommand(program: Command): void {
  program
    .command('ticker <coin>')
    .description('Get the current price of a coin in USD (or MXN with --quote mxn).')
    .option('--quote <currency>', 'Output currency: usd (default) or mxn.', 'usd')
    .option('-o, --output <format>', 'Output format: table (default) or json.', 'table')
    .option('--api-url <url>', 'Bitso API base URL (for sandbox testing).', 'https://api.bitso.com')
    .action(async (coin: string, opts: { quote: string; output: string; apiUrl: string }, cmd: Command) => {
      const isJson = opts.output.toLowerCase() === 'json';
      const { stage } = cmd.optsWithGlobals<{ stage?: boolean }>();
      const apiUrl = stage ? 'https://stage.bitso.com' : opts.apiUrl;
      const client = new PublicHttpClient(apiUrl);

      try {
        let book: string;
        try {
          book = resolveBook(coin);
        } catch (e) {
          printError({
            category: 'validation',
            code: 'unknown_coin',
            message: (e as Error).message,
            suggestion: 'Supported coins: btc, eth, sol.',
            retryable: false,
            docs_url: '',
          }, isJson);
          process.exit(1);
        }

        const tickerData = await client.get('/api/v3/ticker', { book });

        const last = String(tickerData['last'] ?? '0');
        const bid = String(tickerData['bid'] ?? '0');
        const ask = String(tickerData['ask'] ?? '0');
        const high = String(tickerData['high'] ?? '0');
        const low = String(tickerData['low'] ?? '0');
        const volume = String(tickerData['volume'] ?? '0');
        const vwap = String(tickerData['vwap'] ?? '0');

        if (opts.quote.toLowerCase() === 'usd') {
          const result: TickerResult = {
            coin: coin.toLowerCase(),
            book,
            currency: 'usd',
            last, bid, ask, high, low, volume, vwap,
          };
          console.log(isJson ? JsonOutput.success(result) : TableOutput.ticker(result));
          return;
        }

        if (opts.quote.toLowerCase() === 'mxn') {
          let fxData: Record<string, unknown>;
          try {
            fxData = await client.get('/api/v3/ticker', { book: FX_BOOK });
          } catch {
            printError({
              category: 'api',
              code: 'fx_unavailable',
              message: `The ${FX_BOOK} book is not available.`,
              suggestion: 'Try without --quote mxn for USD pricing.',
              retryable: false,
              docs_url: '',
            }, isJson);
            process.exit(1);
          }

          const fxBid = String(fxData['bid'] ?? '0');
          const fxAsk = String(fxData['ask'] ?? '0');
          const fxMid = (parseFloat(fxBid) + parseFloat(fxAsk)) / 2;

          const convert = (s: string): string => {
            if (s === '0') return '0';
            return (parseFloat(s) * fxMid).toFixed(2);
          };

          const fxInfo: FxInfo = {
            rate: fxMid.toFixed(8),
            source: `bitso:${FX_BOOK}`,
            source_bid: fxBid,
            source_ask: fxAsk,
            timestamp: new Date().toISOString(),
          };

          const result: TickerResult = {
            coin: coin.toLowerCase(),
            book,
            currency: 'mxn',
            last: convert(last),
            bid: convert(bid),
            ask: convert(ask),
            high: convert(high),
            low: convert(low),
            volume,
            vwap: convert(vwap),
            fx: fxInfo,
          };
          console.log(isJson ? JsonOutput.success(result) : TableOutput.ticker(result));
          return;
        }

        printError({
          category: 'validation',
          code: 'invalid_quote',
          message: `Unsupported quote currency: ${opts.quote}.`,
          suggestion: "Use 'usd' or 'mxn'.",
          retryable: false,
          docs_url: '',
        }, isJson);
        process.exit(1);

      } catch (e) {
        if (e instanceof BitsoApiError) {
          printError(e.error, isJson);
          process.exit(1);
        }
        throw e;
      }
    });
}
