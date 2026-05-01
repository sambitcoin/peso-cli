import type { Command } from 'commander';
import { AuthenticatedHttpClient } from '../http-auth.js';
import { BitsoApiError } from '../http-public.js';
import { loadCredentials, CredentialMissingError, readSecretFromStdin, readSecretFromFile } from '../credential-store.js';
import { JsonOutput, TableOutput, printError } from '../output.js';
import type { BitsoError, OrderResult, OrderListResult, PlaceOrderRequest, ValidateResult } from '../types.js';

type CommonOpts = {
  apiKey?: string;
  apiSecretStdin?: boolean;
  apiSecretFile?: string;
  output: string;
  apiUrl: string;
};

function validateOrderParams(
  book: string,
  type: string,
  major: string | undefined,
  minor: string | undefined,
  price: string | undefined,
): BitsoError | null {
  const normalizedType = type.toLowerCase();
  if (normalizedType !== 'market' && normalizedType !== 'limit') {
    return { category: 'validation', code: 'invalid_order_type', message: "Order type must be 'market' or 'limit'.", suggestion: '', retryable: false, docs_url: '' };
  }
  if (normalizedType === 'limit' && price == null) {
    return { category: 'validation', code: 'missing_price', message: '--price is required for limit orders.', suggestion: '', retryable: false, docs_url: '' };
  }
  if (major != null && minor != null) {
    return { category: 'validation', code: 'ambiguous_amount', message: 'Specify --major or --minor, not both.', suggestion: '', retryable: false, docs_url: '' };
  }
  if (major != null) {
    const v = parseFloat(major);
    if (isNaN(v) || v <= 0) {
      return { category: 'validation', code: 'invalid_amount', message: '--major must be a positive number.', suggestion: '', retryable: false, docs_url: '' };
    }
  }
  if (minor != null) {
    const v = parseFloat(minor);
    if (isNaN(v) || v <= 0) {
      return { category: 'validation', code: 'invalid_amount', message: '--minor must be a positive number.', suggestion: '', retryable: false, docs_url: '' };
    }
  }
  if (major == null && minor == null) {
    return { category: 'validation', code: 'missing_amount', message: 'Specify either --major or --minor amount.', suggestion: '', retryable: false, docs_url: '' };
  }
  if (price != null) {
    const v = parseFloat(price);
    if (isNaN(v) || v <= 0) {
      return { category: 'validation', code: 'invalid_price', message: '--price must be a positive number.', suggestion: '', retryable: false, docs_url: '' };
    }
  }
  if (!/^[a-z]{3,4}_[a-z]{3,4}$/.test(book)) {
    return { category: 'validation', code: 'invalid_book_format', message: "Book must be in format 'xxx_yyy' (e.g., btc_usdc).", suggestion: '', retryable: false, docs_url: '' };
  }
  return null;
}

async function loadCreds(opts: CommonOpts) {
  let secretBuf: Buffer | undefined;
  if (opts.apiSecretStdin) {
    secretBuf = await readSecretFromStdin();
  } else if (opts.apiSecretFile) {
    secretBuf = readSecretFromFile(opts.apiSecretFile);
  }
  return loadCredentials(opts.apiKey || undefined, secretBuf);
}

export function registerOrderCommand(program: Command): void {
  const order = program
    .command('order')
    .description('Place or manage orders.');

  order.action(() => {
    order.help();
  });

  // buy
  order
    .command('buy <book>')
    .description('Place a buy order.')
    .requiredOption('--type <type>', 'Order type: market or limit.')
    .option('--major <amount>', 'Amount in major (fiat) currency.')
    .option('--minor <amount>', 'Amount in minor (crypto) currency.')
    .option('--price <price>', 'Price (required for limit orders).')
    .option('--validate', 'Dry-run: validate parameters only. Does not call API.')
    .option('--client-id <id>', 'Client-specified order ID for idempotency.')
    .option('--api-key <key>', 'Bitso API key.')
    .option('--api-secret-stdin', 'Read API secret from stdin.')
    .option('--api-secret-file <path>', 'Path to file containing the API secret.')
    .option('-o, --output <format>', 'Output format: json (default) or table.', 'json')
    .option('--api-url <url>', 'Bitso API base URL (for sandbox testing).', 'https://api.bitso.com')
    .action(async (book: string, opts: CommonOpts & {
      type: string; major?: string; minor?: string; price?: string;
      validate?: boolean; clientId?: string;
    }) => {
      const isJson = opts.output.toLowerCase() === 'json';

      const validationError = validateOrderParams(book, opts.type, opts.major, opts.minor, opts.price);
      if (validationError) {
        printError(validationError, isJson);
        process.exit(1);
      }

      const request: PlaceOrderRequest = {
        book,
        side: 'buy',
        type: opts.type.toLowerCase(),
        ...(opts.major != null ? { major: opts.major } : {}),
        ...(opts.minor != null ? { minor: opts.minor } : {}),
        ...(opts.price != null ? { price: opts.price } : {}),
        ...(opts.clientId != null ? { client_id: opts.clientId } : {}),
      };

      if (opts.validate) {
        const result: ValidateResult = { status: 'valid', would_send: request };
        console.log(isJson ? JsonOutput.success(result) : TableOutput.validate(result));
        return;
      }

      try {
        const credentials = await loadCreds(opts);
        const client = new AuthenticatedHttpClient(credentials, opts.apiUrl);

        const bodyObj: Record<string, unknown> = {
          book: request.book,
          side: request.side,
          type: request.type,
        };
        if (request.major != null) bodyObj['major'] = request.major;
        if (request.minor != null) bodyObj['minor'] = request.minor;
        if (request.price != null) bodyObj['price'] = request.price;
        if (request.client_id != null) bodyObj['client_id'] = request.client_id;

        const response = await client.signedPost('/api/v3/orders', bodyObj);
        client.destroySigner();

        const result: OrderResult = {
          oid: String(response['oid'] ?? '?'),
          book,
          side: 'buy',
          type: opts.type.toLowerCase(),
          ...(opts.price != null ? { price: opts.price } : {}),
          ...(opts.major != null ? { major: opts.major } : {}),
          ...(opts.minor != null ? { minor: opts.minor } : {}),
          ...(response['created_at'] != null ? { created_at: String(response['created_at']) } : {}),
          ...(response['status'] != null ? { status: String(response['status']) } : {}),
        };

        console.log(isJson ? JsonOutput.success(result) : TableOutput.order(result));

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

  // sell
  order
    .command('sell <book>')
    .description('Place a sell order.')
    .requiredOption('--type <type>', 'Order type: market or limit.')
    .option('--major <amount>', 'Amount in major (fiat) currency.')
    .option('--minor <amount>', 'Amount in minor (crypto) currency.')
    .option('--price <price>', 'Price (required for limit orders).')
    .option('--validate', 'Dry-run: validate parameters only. Does not call API.')
    .option('--client-id <id>', 'Client-specified order ID for idempotency.')
    .option('--api-key <key>', 'Bitso API key.')
    .option('--api-secret-stdin', 'Read API secret from stdin.')
    .option('--api-secret-file <path>', 'Path to file containing the API secret.')
    .option('-o, --output <format>', 'Output format: json (default) or table.', 'json')
    .option('--api-url <url>', 'Bitso API base URL (for sandbox testing).', 'https://api.bitso.com')
    .action(async (book: string, opts: CommonOpts & {
      type: string; major?: string; minor?: string; price?: string;
      validate?: boolean; clientId?: string;
    }) => {
      const isJson = opts.output.toLowerCase() === 'json';

      const validationError = validateOrderParams(book, opts.type, opts.major, opts.minor, opts.price);
      if (validationError) {
        printError(validationError, isJson);
        process.exit(1);
      }

      const request: PlaceOrderRequest = {
        book,
        side: 'sell',
        type: opts.type.toLowerCase(),
        ...(opts.major != null ? { major: opts.major } : {}),
        ...(opts.minor != null ? { minor: opts.minor } : {}),
        ...(opts.price != null ? { price: opts.price } : {}),
        ...(opts.clientId != null ? { client_id: opts.clientId } : {}),
      };

      if (opts.validate) {
        const result: ValidateResult = { status: 'valid', would_send: request };
        console.log(isJson ? JsonOutput.success(result) : TableOutput.validate(result));
        return;
      }

      try {
        const credentials = await loadCreds(opts);
        const client = new AuthenticatedHttpClient(credentials, opts.apiUrl);

        const bodyObj: Record<string, unknown> = {
          book: request.book,
          side: request.side,
          type: request.type,
        };
        if (request.major != null) bodyObj['major'] = request.major;
        if (request.minor != null) bodyObj['minor'] = request.minor;
        if (request.price != null) bodyObj['price'] = request.price;
        if (request.client_id != null) bodyObj['client_id'] = request.client_id;

        const response = await client.signedPost('/api/v3/orders', bodyObj);
        client.destroySigner();

        const result: OrderResult = {
          oid: String(response['oid'] ?? '?'),
          book,
          side: 'sell',
          type: opts.type.toLowerCase(),
          ...(opts.price != null ? { price: opts.price } : {}),
          ...(opts.major != null ? { major: opts.major } : {}),
          ...(opts.minor != null ? { minor: opts.minor } : {}),
          ...(response['created_at'] != null ? { created_at: String(response['created_at']) } : {}),
          ...(response['status'] != null ? { status: String(response['status']) } : {}),
        };

        console.log(isJson ? JsonOutput.success(result) : TableOutput.order(result));

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

  // list
  order
    .command('list')
    .description('List open orders. Optionally filter by book.')
    .option('--book <book>', 'Filter by book (e.g., btc_usdc). Shows all if omitted.')
    .option('--api-key <key>', 'Bitso API key.')
    .option('--api-secret-stdin', 'Read API secret from stdin.')
    .option('--api-secret-file <path>', 'Path to file containing the API secret.')
    .option('-o, --output <format>', 'Output format: json (default) or table.', 'json')
    .option('--api-url <url>', 'Bitso API base URL (for sandbox testing).', 'https://api.bitso.com')
    .action(async (opts: CommonOpts & { book?: string }) => {
      const isJson = opts.output.toLowerCase() === 'json';

      try {
        const credentials = await loadCreds(opts);
        const client = new AuthenticatedHttpClient(credentials, opts.apiUrl);

        const params: Record<string, string> = {};
        if (opts.book) params['book'] = opts.book;

        const payload = await client.signedGet('/api/v3/open_orders', params);
        client.destroySigner();

        const ordersRaw = payload['orders'];
        const orders: OrderResult[] = Array.isArray(ordersRaw)
          ? ordersRaw.map((el: unknown) => {
              const obj = el as Record<string, unknown>;
              return {
                oid: String(obj['oid'] ?? '?'),
                book: String(obj['book'] ?? '?'),
                side: String(obj['side'] ?? '?'),
                type: String(obj['type'] ?? '?'),
                ...(obj['price'] != null ? { price: String(obj['price']) } : {}),
                ...(obj['major'] != null ? { major: String(obj['major']) } : {}),
                ...(obj['minor'] != null ? { minor: String(obj['minor']) } : {}),
                ...(obj['created_at'] != null ? { created_at: String(obj['created_at']) } : {}),
                ...(obj['status'] != null ? { status: String(obj['status']) } : {}),
                ...(obj['filled'] != null ? { filled: String(obj['filled']) } : {}),
              };
            })
          : [];

        const result: OrderListResult = { orders };

        console.log(isJson ? JsonOutput.success(result) : TableOutput.orderList(result));

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
