import type { Command } from 'commander';
import { AuthenticatedHttpClient } from '../http-auth.js';
import { BitsoApiError } from '../http-public.js';
import { loadCredentials, CredentialMissingError, readSecretFromStdin, readSecretFromFile } from '../credential-store.js';
import { JsonOutput, TableOutput, printError } from '../output.js';
import type { BalanceResult, BalanceEntry } from '../types.js';

export function registerBalanceCommand(program: Command): void {
  program
    .command('balance')
    .description('Show account balances for all assets.')
    .option('--api-key <key>', 'Bitso API key.')
    .option('--api-secret-stdin', 'Read API secret from stdin.')
    .option('--api-secret-file <path>', 'Path to file containing the API secret.')
    .option('-o, --output <format>', 'Output format: json (default) or table.', 'json')
    .option('--api-url <url>', 'Bitso API base URL (for sandbox testing).', 'https://api.bitso.com')
    .action(async (opts: {
      apiKey?: string;
      apiSecretStdin?: boolean;
      apiSecretFile?: string;
      output: string;
      apiUrl: string;
    }) => {
      const isJson = opts.output.toLowerCase() === 'json';

      try {
        let secretBuf: Buffer | undefined;
        if (opts.apiSecretStdin) {
          secretBuf = await readSecretFromStdin();
        } else if (opts.apiSecretFile) {
          secretBuf = readSecretFromFile(opts.apiSecretFile);
        }

        const credentials = loadCredentials(opts.apiKey || undefined, secretBuf);
        const client = new AuthenticatedHttpClient(credentials, opts.apiUrl);

        const payload = await client.signedGet('/api/v3/balance');
        client.destroySigner();

        const balancesRaw = payload['balances'];
        const balances: BalanceEntry[] = Array.isArray(balancesRaw)
          ? balancesRaw.map((el: unknown) => {
              const obj = el as Record<string, unknown>;
              return {
                currency: String(obj['currency'] ?? '?'),
                total: String(obj['total'] ?? '0'),
                available: String(obj['available'] ?? '0'),
                locked: String(obj['locked'] ?? '0'),
              };
            })
          : [];

        const result: BalanceResult = { balances };

        if (isJson) {
          console.log(JsonOutput.success(result));
        } else {
          console.log(TableOutput.balance(result));
        }

      } catch (e) {
        if (e instanceof CredentialMissingError) {
          printError({
            category: 'auth',
            code: 'missing_credentials',
            message: e.message,
            suggestion: "Use 'bitso auth set --api-key <key> --api-secret-stdin' to configure.",
            retryable: false,
            docs_url: '',
          }, isJson);
          process.exit(1);
        }
        if (e instanceof BitsoApiError) {
          printError(e.error, isJson);
          process.exit(1);
        }
        throw e;
      }
    });
}
