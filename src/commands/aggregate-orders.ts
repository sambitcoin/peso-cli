import { type Command } from 'commander';
import { fetchBitsoOrders, fetchGbmOrders, type BrokerOrdersResult } from '../order-fetcher.js';
import { JsonOutput } from '../output.js';
import type { OrderResult } from '../types.js';

function pad(s: string, n: number): string {
  return s.substring(0, n).padEnd(n);
}

function renderBrokerTable(r: BrokerOrdersResult): string {
  const lines: string[] = [];
  lines.push(`  ${r.broker.toUpperCase()}`);
  if (r.status === 'unavailable') {
    lines.push(`    (unavailable: ${r.reason})`);
  } else if (r.orders.length === 0) {
    lines.push('    (no open orders)');
  } else {
    lines.push(`    ${pad('OID', 14)}  ${pad('Book', 9)}  ${pad('Side', 4)}  ${pad('Type', 6)}  ${pad('Price', 12)}  ${pad('Amount', 14)}  ${'Status'}`);
    lines.push(`    ${pad('──────────────', 14)}  ${pad('─────────', 9)}  ${pad('────', 4)}  ${pad('──────', 6)}  ${pad('────────────', 12)}  ${pad('──────────────', 14)}  ${'────────'}`);
    r.orders.forEach((o: OrderResult) => {
      const amt = o.major ?? o.minor ?? '-';
      lines.push(`    ${pad(o.oid, 14)}  ${pad(o.book, 9)}  ${pad(o.side, 4)}  ${pad(o.type, 6)}  ${pad(o.price ?? '-', 12)}  ${pad(amt, 14)}  ${o.status ?? '-'}`);
    });
  }
  return lines.join('\n');
}

export function registerAggregateOrderListCommand(program: Command): void {
  const order = program
    .command('order')
    .description('Manage orders across all brokers.');
  order.action(() => { order.help(); });

  order
    .command('list')
    .description('List open orders across all brokers (Bitso, GBM).')
    .option('--book <book>', 'Filter by book (e.g. btc_usdc). Bitso only.')
    .option('--bitso-api-key <key>', 'Bitso API key.')
    .option('--bitso-api-secret-stdin', 'Read Bitso API secret from stdin.')
    .option('--bitso-api-secret-file <path>', 'Path to file containing the Bitso API secret.')
    .option('--bitso-api-url <url>', 'Bitso API base URL.', 'https://api.bitso.com')
    .option('-o, --output <format>', 'Output format: table (default) or json.', 'table')
    .action(async (opts: {
      book?: string;
      bitsoApiKey?: string;
      bitsoApiSecretStdin?: boolean;
      bitsoApiSecretFile?: string;
      bitsoApiUrl: string;
      output: string;
    }) => {
      const isJson = opts.output.toLowerCase() === 'json';

      const [bitso, gbm] = await Promise.all([
        fetchBitsoOrders({
          ...(opts.bitsoApiKey != null ? { apiKey: opts.bitsoApiKey } : {}),
          ...(opts.bitsoApiSecretStdin != null ? { apiSecretStdin: opts.bitsoApiSecretStdin } : {}),
          ...(opts.bitsoApiSecretFile != null ? { apiSecretFile: opts.bitsoApiSecretFile } : {}),
          apiUrl: opts.bitsoApiUrl,
          ...(opts.book != null ? { book: opts.book } : {}),
        }),
        fetchGbmOrders(),
      ]);

      const results = [bitso, gbm];

      if (isJson) {
        console.log(JsonOutput.success({ brokers: results }));
      } else {
        console.log(results.map(renderBrokerTable).join('\n\n') + '\n');
      }
    });
}
