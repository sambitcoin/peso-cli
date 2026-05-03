import { AuthenticatedHttpClient } from './http-auth.js';
import { loadCredentials, CredentialMissingError, readSecretFromStdin, readSecretFromFile } from './credential-store.js';
import type { BalanceEntry } from './types.js';

export type BrokerPositionsResult =
  | { broker: string; status: 'ok'; balances: BalanceEntry[] }
  | { broker: string; status: 'unavailable'; reason: string };

export async function fetchBitsoPositions(opts: {
  apiKey?: string;
  apiSecretStdin?: boolean;
  apiSecretFile?: string;
  apiUrl: string;
}): Promise<BrokerPositionsResult> {
  try {
    let secretBuf: Buffer | undefined;
    if (opts.apiSecretStdin) secretBuf = await readSecretFromStdin();
    else if (opts.apiSecretFile) secretBuf = readSecretFromFile(opts.apiSecretFile);

    const credentials = loadCredentials(opts.apiKey || undefined, secretBuf);
    const client = new AuthenticatedHttpClient(credentials, opts.apiUrl);
    const payload = await client.signedGet('/api/v3/balance');
    client.destroySigner();

    const raw = payload['balances'];
    const balances: BalanceEntry[] = Array.isArray(raw)
      ? raw.map((el: unknown) => {
          const o = el as Record<string, unknown>;
          return {
            currency: String(o['currency'] ?? '?'),
            total: String(o['total'] ?? '0'),
            available: String(o['available'] ?? '0'),
            locked: String(o['locked'] ?? '0'),
            ...(o['pending_deposit'] != null ? { pending_deposit: String(o['pending_deposit']) } : {}),
            ...(o['pending_withdrawal'] != null ? { pending_withdrawal: String(o['pending_withdrawal']) } : {}),
          };
        })
      : [];

    return { broker: 'bitso', status: 'ok', balances };
  } catch (e) {
    const reason = e instanceof CredentialMissingError
      ? 'credentials not configured'
      : (e as Error).message ?? 'unknown error';
    return { broker: 'bitso', status: 'unavailable', reason };
  }
}

export async function fetchGbmPositions(): Promise<BrokerPositionsResult> {
  return { broker: 'gbm', status: 'unavailable', reason: 'not implemented' };
}
