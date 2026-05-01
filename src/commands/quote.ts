import { type Command } from 'commander';
import { AuthenticatedHttpClient } from '../http-auth.js';
import { BitsoApiError } from '../http-public.js';
import { loadCredentials, CredentialMissingError, readSecretFromStdin, readSecretFromFile } from '../credential-store.js';
import { JsonOutput, printError } from '../output.js';
import type { QuoteResult, QuoteExecuteResult, BitsoError } from '../types.js';

type CommonOpts = {
  apiKey?: string;
  apiSecretStdin?: boolean;
  apiSecretFile?: string;
  output: string;
  apiUrl: string;
};

async function loadCreds(opts: CommonOpts) {
  let secretBuf: Buffer | undefined;
  if (opts.apiSecretStdin) {
    secretBuf = await readSecretFromStdin();
  } else if (opts.apiSecretFile) {
    secretBuf = readSecretFromFile(opts.apiSecretFile);
  }
  return loadCredentials(opts.apiKey || undefined, secretBuf);
}

function formatQuoteTable(r: QuoteResult): string {
  const lines = [
    `  Quote ID: ${r.id}`,
    `  From:     ${r.from_amount} ${r.from_currency.toUpperCase()}`,
    `  To:       ${r.to_amount} ${r.to_currency.toUpperCase()}`,
    `  Rate:     ${r.rate}`,
  ];
  if (r.estimated_slippage_value != null) {
    lines.push(`  Slippage: ${r.estimated_slippage_value}% (${r.estimated_slippage_level ?? 'unknown'})`);
  }
  lines.push(`  Expires:  ${r.expires}  ← execute within 30 seconds`);
  return lines.join('\n') + '\n';
}

function formatExecuteTable(r: QuoteExecuteResult): string {
  return `  Conversion ID: ${r.oid}\n  Status: accepted\n`;
}

export function registerQuoteCommand(program: Command): void {
  const quote = program
    .command('quote')
    .description('Request or execute a currency conversion quote (USD only).');

  quote.action(() => {
    quote.help();
  });

  // quote request
  quote
    .command('request')
    .description('Request a conversion quote. Valid for 30 seconds.')
    .requiredOption('--from <currency>', 'Source currency (e.g. mxn, usd).')
    .requiredOption('--to <currency>', 'Destination currency (e.g. usd, mxn).')
    .option('--spend <amount>', 'Amount to convert from the source currency.')
    .option('--receive <amount>', 'Amount to receive in the destination currency.')
    .option('--api-key <key>', 'Bitso API key.')
    .option('--api-secret-stdin', 'Read API secret from stdin.')
    .option('--api-secret-file <path>', 'Path to file containing the API secret.')
    .option('-o, --output <format>', 'Output format: table (default) or json.', 'table')
    .option('--api-url <url>', 'Bitso API base URL (for sandbox testing).', 'https://api.bitso.com')
    .action(async (opts: CommonOpts & {
      from: string;
      to: string;
      spend?: string;
      receive?: string;
    }, cmd: Command) => {
      const isJson = opts.output.toLowerCase() === 'json';
      const { stage } = cmd.optsWithGlobals<{ stage?: boolean }>();
      const apiUrl = stage ? 'https://stage.bitso.com' : opts.apiUrl;

      const from = opts.from.toLowerCase();
      const to = opts.to.toLowerCase();

      if (from !== 'usd' && to !== 'usd') {
        printError({
          category: 'validation',
          code: 'non_usd_quote',
          message: 'Only USD quotes are supported. Either --from or --to must be usd.',
          suggestion: 'Example: --from mxn --to usd or --from usd --to mxn.',
          retryable: false,
          docs_url: '',
        } satisfies BitsoError, isJson);
        process.exit(1);
      }

      if (opts.spend != null && opts.receive != null) {
        printError({
          category: 'validation',
          code: 'ambiguous_amount',
          message: 'Specify --spend or --receive, not both.',
          suggestion: '',
          retryable: false,
          docs_url: '',
        } satisfies BitsoError, isJson);
        process.exit(1);
      }

      if (opts.spend == null && opts.receive == null) {
        printError({
          category: 'validation',
          code: 'missing_amount',
          message: 'Specify either --spend or --receive.',
          suggestion: '',
          retryable: false,
          docs_url: '',
        } satisfies BitsoError, isJson);
        process.exit(1);
      }

      const amount = opts.spend != null ? parseFloat(opts.spend) : parseFloat(opts.receive!);
      if (isNaN(amount) || amount <= 0) {
        printError({
          category: 'validation',
          code: 'invalid_amount',
          message: 'Amount must be a positive number.',
          suggestion: '',
          retryable: false,
          docs_url: '',
        } satisfies BitsoError, isJson);
        process.exit(1);
      }

      try {
        const credentials = await loadCreds(opts);
        const client = new AuthenticatedHttpClient(credentials, apiUrl);

        const body: Record<string, unknown> = { from_currency: from, to_currency: to };
        if (opts.spend != null) body['spend_amount'] = opts.spend;
        else body['receive_amount'] = opts.receive;

        const payload = await client.signedPost('/api/v4/currency_conversions', body);
        client.destroySigner();

        const slippage = payload['estimated_slippage'] as Record<string, unknown> | undefined;

        const result: QuoteResult = {
          id: String(payload['id'] ?? '?'),
          from_currency: String(payload['from_currency'] ?? from),
          to_currency: String(payload['to_currency'] ?? to),
          from_amount: String(payload['from_amount'] ?? '?'),
          to_amount: String(payload['to_amount'] ?? '?'),
          rate: String(payload['rate'] ?? '?'),
          expires: String(payload['expires'] ?? '?'),
          ...(slippage != null ? {
            estimated_slippage_value: String(slippage['value'] ?? ''),
            estimated_slippage_level: String(slippage['level'] ?? ''),
          } : {}),
        };

        console.log(isJson ? JsonOutput.success(result) : formatQuoteTable(result));

      } catch (e) {
        if (e instanceof CredentialMissingError) {
          printError({ category: 'auth', code: 'missing_credentials', message: e.message, suggestion: "Use 'bitso auth set --api-key <key> --api-secret-stdin' to configure.", retryable: false, docs_url: '' }, isJson);
          process.exit(1);
        }
        if (e instanceof BitsoApiError) {
          printError(e.error, isJson);
          process.exit(1);
        }
        throw e;
      }
    });

  // quote execute
  quote
    .command('execute <quote_id>')
    .description('Execute a previously requested quote. Must be done within 30 seconds.')
    .option('--api-key <key>', 'Bitso API key.')
    .option('--api-secret-stdin', 'Read API secret from stdin.')
    .option('--api-secret-file <path>', 'Path to file containing the API secret.')
    .option('-o, --output <format>', 'Output format: table (default) or json.', 'table')
    .option('--api-url <url>', 'Bitso API base URL (for sandbox testing).', 'https://api.bitso.com')
    .action(async (quoteId: string, opts: CommonOpts, cmd: Command) => {
      const isJson = opts.output.toLowerCase() === 'json';
      const { stage } = cmd.optsWithGlobals<{ stage?: boolean }>();
      const apiUrl = stage ? 'https://stage.bitso.com' : opts.apiUrl;

      try {
        const credentials = await loadCreds(opts);
        const client = new AuthenticatedHttpClient(credentials, apiUrl);

        const payload = await client.signedPut(`/api/v4/currency_conversions/${quoteId}`);
        client.destroySigner();

        const result: QuoteExecuteResult = {
          oid: String(payload['oid'] ?? '?'),
        };

        console.log(isJson ? JsonOutput.success(result) : formatExecuteTable(result));

      } catch (e) {
        if (e instanceof CredentialMissingError) {
          printError({ category: 'auth', code: 'missing_credentials', message: e.message, suggestion: "Use 'bitso auth set --api-key <key> --api-secret-stdin' to configure.", retryable: false, docs_url: '' }, isJson);
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
