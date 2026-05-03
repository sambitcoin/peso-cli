import { AuthenticatedHttpClient } from './http-auth.js';
import { loadCredentials, CredentialMissingError, readSecretFromStdin, readSecretFromFile } from './credential-store.js';
import type { OrderResult } from './types.js';

export type BrokerOrdersResult =
  | { broker: string; status: 'ok'; orders: OrderResult[] }
  | { broker: string; status: 'unavailable'; reason: string };

export async function fetchBitsoOrders(opts: {
  apiKey?: string;
  apiSecretStdin?: boolean;
  apiSecretFile?: string;
  apiUrl: string;
  book?: string;
}): Promise<BrokerOrdersResult> {
  try {
    let secretBuf: Buffer | undefined;
    if (opts.apiSecretStdin) secretBuf = await readSecretFromStdin();
    else if (opts.apiSecretFile) secretBuf = readSecretFromFile(opts.apiSecretFile);

    const credentials = loadCredentials(opts.apiKey || undefined, secretBuf);
    const client = new AuthenticatedHttpClient(credentials, opts.apiUrl);

    const params: Record<string, string> = {};
    if (opts.book) params['book'] = opts.book;

    const payload = await client.signedGet('/api/v3/open_orders', params);
    client.destroySigner();

    const raw = payload['orders'];
    const orders: OrderResult[] = Array.isArray(raw)
      ? raw.map((el: unknown) => {
          const o = el as Record<string, unknown>;
          return {
            oid: String(o['oid'] ?? '?'),
            book: String(o['book'] ?? '?'),
            side: String(o['side'] ?? '?'),
            type: String(o['type'] ?? '?'),
            ...(o['price'] != null ? { price: String(o['price']) } : {}),
            ...(o['major'] != null ? { major: String(o['major']) } : {}),
            ...(o['minor'] != null ? { minor: String(o['minor']) } : {}),
            ...(o['created_at'] != null ? { created_at: String(o['created_at']) } : {}),
            ...(o['status'] != null ? { status: String(o['status']) } : {}),
            ...(o['filled'] != null ? { filled: String(o['filled']) } : {}),
          };
        })
      : [];

    return { broker: 'bitso', status: 'ok', orders };
  } catch (e) {
    const reason = e instanceof CredentialMissingError
      ? 'credentials not configured'
      : (e as Error).message ?? 'unknown error';
    return { broker: 'bitso', status: 'unavailable', reason };
  }
}

export async function fetchGbmOrders(): Promise<BrokerOrdersResult> {
  return { broker: 'gbm', status: 'unavailable', reason: 'not implemented' };
}
