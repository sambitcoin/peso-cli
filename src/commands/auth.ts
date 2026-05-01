import type { Command } from 'commander';
import { AuthenticatedHttpClient } from '../http-auth.js';
import { BitsoApiError } from '../http-public.js';
import {
  loadCredentials,
  CredentialMissingError,
  writeCredentials,
  readSecretFromStdin,
  readSecretFromFile,
} from '../credential-store.js';
import { JsonOutput, TableOutput, printError } from '../output.js';

export function registerAuthCommand(program: Command): void {
  const auth = program
    .command('auth')
    .description('Manage Bitso API credentials.');

  auth.action(() => {
    auth.help();
  });

  // auth set
  auth
    .command('set')
    .description('Configure API credentials and write them to ~/.config/bitso/config.toml.')
    .requiredOption('--api-key <key>', 'Bitso API key.')
    .option('--api-secret-stdin', 'Read API secret from stdin (recommended).')
    .option('--api-secret-file <path>', 'Read API secret from a file.')
    .option('--api-secret <secret>', '(INSECURE) API secret as a direct argument.', '')
    .option('-o, --output <format>', 'Output format: json (default) or table.', 'json')
    .action(async (opts: {
      apiKey: string;
      apiSecretStdin?: boolean;
      apiSecretFile?: string;
      apiSecret: string;
      output: string;
    }) => {
      const isJson = opts.output.toLowerCase() === 'json';

      try {
        let secretBuf: Buffer;
        if (opts.apiSecretStdin) {
          secretBuf = await readSecretFromStdin();
        } else if (opts.apiSecretFile) {
          secretBuf = readSecretFromFile(opts.apiSecretFile);
        } else if (opts.apiSecret) {
          secretBuf = Buffer.from(opts.apiSecret, 'utf8');
        } else {
          throw new Error('No API secret provided. Use --api-secret-stdin or --api-secret-file.');
        }

        const configPath = writeCredentials(opts.apiKey, secretBuf);
        secretBuf.fill(0);

        if (isJson) {
          console.log(JsonOutput.success({ status: 'ok', config_path: configPath }));
        } else {
          console.log(`Credentials saved to ${configPath}`);
        }

      } catch (e) {
        printError({
          category: 'auth',
          code: 'config_write_failed',
          message: (e as Error).message ?? 'Failed to write credentials.',
          suggestion: 'Ensure the config directory is writable.',
          retryable: false,
          docs_url: '',
        }, isJson);
        process.exit(1);
      }
    });

  // auth test
  auth
    .command('test')
    .description('Verify that the configured API credentials work by calling GET /api/v3/balance.')
    .option('--api-key <key>', 'Bitso API key (overrides config).')
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

        await client.signedGet('/api/v3/balance');
        client.destroySigner();

        if (isJson) {
          console.log(JsonOutput.success({ status: 'ok' }));
        } else {
          console.log(TableOutput.authTest('ok'));
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
