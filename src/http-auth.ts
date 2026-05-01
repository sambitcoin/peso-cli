import type { Credentials } from './credential-store.js';
import { Signer } from './signer.js';
import { mapBitsoError } from './error-mapper.js';
import { BitsoApiError } from './http-public.js';

interface BitsoEnvelope {
  success: boolean;
  payload?: unknown;
  error?: { code?: string; message?: string };
}

async function unwrapEnvelope(response: Response): Promise<Record<string, unknown>> {
  let body: BitsoEnvelope;
  try {
    body = (await response.json()) as BitsoEnvelope;
  } catch {
    throw new BitsoApiError(mapBitsoError(null, 'Failed to parse response body', response.status));
  }

  if (!body.success) {
    const code = body.error?.code ?? null;
    const message = body.error?.message ?? null;
    throw new BitsoApiError(mapBitsoError(code, message, response.status));
  }

  if (body.payload == null || typeof body.payload !== 'object') {
    throw new BitsoApiError(mapBitsoError(null, 'Payload missing from response', response.status));
  }

  return body.payload as Record<string, unknown>;
}

export class AuthenticatedHttpClient {
  private readonly signer: Signer;
  private readonly apiKey: string;

  constructor(
    credentials: Credentials,
    private readonly baseUrl: string = 'https://api.bitso.com',
  ) {
    this.signer = new Signer(credentials.apiSecret);
    this.apiKey = credentials.apiKey;
  }

  async signedGet(apiPath: string, params: Record<string, string> = {}): Promise<Record<string, unknown>> {
    const qs = new URLSearchParams(params).toString();
    const fullUrl = `${this.baseUrl}${apiPath}${qs ? '?' + qs : ''}`;
    const nonce = Date.now();
    // Sign path only (not path+query), per Bitso API spec
    const authHeader = this.signer.sign(this.apiKey, nonce, 'GET', apiPath, '');

    let response: Response;
    try {
      response = await fetch(fullUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(30_000),
        headers: {
          'Authorization': authHeader,
          'User-Agent': 'bitso-cli/0.1.0',
        },
      });
    } catch (err) {
      throw new BitsoApiError(mapBitsoError(null, (err as Error).message, 0));
    }

    return unwrapEnvelope(response);
  }

  async signedPost(apiPath: string, bodyObj: Record<string, unknown>): Promise<Record<string, unknown>> {
    const bodyString = JSON.stringify(bodyObj);
    const nonce = Date.now();
    const authHeader = this.signer.sign(this.apiKey, nonce, 'POST', apiPath, bodyString);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${apiPath}`, {
        method: 'POST',
        signal: AbortSignal.timeout(30_000),
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'User-Agent': 'bitso-cli/0.1.0',
        },
        body: bodyString,
      });
    } catch (err) {
      throw new BitsoApiError(mapBitsoError(null, (err as Error).message, 0));
    }

    return unwrapEnvelope(response);
  }

  destroySigner(): void {
    this.signer.destroy();
  }
}
