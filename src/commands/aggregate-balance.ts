import { type Command } from 'commander';
import { fetchBitsoPositions, fetchGbmPositions, type BrokerPositionsResult } from '../balance-fetcher.js';
import { JsonOutput } from '../output.js';
import type { BalanceEntry } from '../types.js';

function pad(s: string, n: number): string {
  return s.substring(0, n).padEnd(n);
}

function filterBalances(r: BrokerPositionsResult, asset: string | undefined): BrokerPositionsResult {
  if (r.status !== 'ok' || asset == null) return r;
  return { ...r, balances: r.balances.filter(b => b.currency.toLowerCase() === asset) };
}

function renderBrokerTable(r: BrokerPositionsResult): string {
  const lines: string[] = [];
  lines.push(`  ${r.broker.toUpperCase()}`);
  if (r.status === 'unavailable') {
    lines.push(`    (unavailable: ${r.reason})`);
  } else if (r.balances.length === 0) {
    lines.push('    (no positions)');
  } else {
    lines.push(`    ${pad('Asset', 6)}  ${pad('Total', 14)}  ${pad('Available', 14)}  ${pad('Locked', 14)}  ${pad('Pend. Deposit', 14)}  ${pad('Pend. Withdraw', 14)}`);
    lines.push(`    ${pad('──────', 6)}  ${pad('──────────────', 14)}  ${pad('──────────────', 14)}  ${pad('──────────────', 14)}  ${pad('──────────────', 14)}  ${pad('──────────────', 14)}`);
    r.balances.forEach((b: BalanceEntry) => {
      lines.push(`    ${pad(b.currency.toUpperCase(), 6)}  ${pad(b.total, 14)}  ${pad(b.available, 14)}  ${pad(b.locked, 14)}  ${pad(b.pending_deposit ?? '0', 14)}  ${pad(b.pending_withdrawal ?? '0', 14)}`);
    });
  }
  return lines.join('\n');
}

export function registerAggregatePositionsCommand(program: Command): void {
  program
    .command('positions [asset]')
    .description('Show aggregated positions across all brokers (Bitso, GBM). Optionally filter by asset (e.g. btc, mxn).')
    .option('--bitso-api-key <key>', 'Bitso API key.')
    .option('--bitso-api-secret-stdin', 'Read Bitso API secret from stdin.')
    .option('--bitso-api-secret-file <path>', 'Path to file containing the Bitso API secret.')
    .option('--bitso-api-url <url>', 'Bitso API base URL.', 'https://api.bitso.com')
    .option('-o, --output <format>', 'Output format: table (default) or json.', 'table')
    .action(async (asset: string | undefined, opts: {
      bitsoApiKey?: string;
      bitsoApiSecretStdin?: boolean;
      bitsoApiSecretFile?: string;
      bitsoApiUrl: string;
      output: string;
    }) => {
      const isJson = opts.output.toLowerCase() === 'json';
      const assetFilter = asset?.toLowerCase();

      const [bitso, gbm] = await Promise.all([
        fetchBitsoPositions({
          ...(opts.bitsoApiKey != null ? { apiKey: opts.bitsoApiKey } : {}),
          ...(opts.bitsoApiSecretStdin != null ? { apiSecretStdin: opts.bitsoApiSecretStdin } : {}),
          ...(opts.bitsoApiSecretFile != null ? { apiSecretFile: opts.bitsoApiSecretFile } : {}),
          apiUrl: opts.bitsoApiUrl,
        }),
        fetchGbmPositions(),
      ]);

      const results = [bitso, gbm].map(r => filterBalances(r, assetFilter));

      if (isJson) {
        console.log(JsonOutput.success({ asset: assetFilter ?? null, brokers: results }));
      } else {
        console.log(results.map(renderBrokerTable).join('\n\n') + '\n');
      }
    });
}
