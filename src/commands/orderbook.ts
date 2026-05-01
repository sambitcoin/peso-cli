import type { Command } from 'commander';
import { PublicHttpClient, BitsoApiError } from '../http-public.js';
import { JsonOutput, TableOutput, printError } from '../output.js';
import type { OrderBookResult, OrderBookEntry } from '../types.js';

export function registerOrderBookCommand(program: Command): void {
  program
    .command('orderbook <book>')
    .description('View the order book for a given Bitso book (bids and asks).')
    .option('--depth <n>', 'Number of price levels to show (per side). Shows all if not set.', '-1')
    .option('-o, --output <format>', 'Output format: json (default) or table.', 'json')
    .option('--api-url <url>', 'Bitso API base URL (for sandbox testing).', 'https://api.bitso.com')
    .action(async (book: string, opts: { depth: string; output: string; apiUrl: string }) => {
      const isJson = opts.output.toLowerCase() === 'json';
      const client = new PublicHttpClient(opts.apiUrl);

      try {
        const data = await client.get('/api/v3/order_book', { book, aggregate: 'true' });

        const sequence = String(data['sequence'] ?? '0');

        const parseLevels = (raw: unknown): OrderBookEntry[] => {
          if (!Array.isArray(raw)) return [];
          return raw.map((el: unknown) => {
            const obj = el as Record<string, unknown>;
            return {
              price: String(obj['price'] ?? '0'),
              amount: String(obj['amount'] ?? '0'),
            };
          });
        };

        const result: OrderBookResult = {
          book,
          sequence,
          bids: parseLevels(data['bids']),
          asks: parseLevels(data['asks']),
        };

        if (isJson) {
          console.log(JsonOutput.success(result));
        } else {
          const depth = parseInt(opts.depth, 10);
          const showDepth = depth > 0 ? depth : Number.MAX_SAFE_INTEGER;
          console.log(TableOutput.orderBook(result, showDepth));
        }

      } catch (e) {
        if (e instanceof BitsoApiError) {
          printError(e.error, isJson);
          process.exit(1);
        }
        throw e;
      }
    });
}
