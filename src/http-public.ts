import type { BitsoError } from './types.js';
import { mapBitsoError } from './error-mapper.js';

export class BitsoApiError extends Error {
  constructor(public readonly error: BitsoError) {
    super(error.message);
  }
}

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

export class PublicHttpClient {
  constructor(
    private readonly baseUrl: string = 'https://api.bitso.com',
  ) {}

  async get(apiPath: string, params: Record<string, string> = {}): Promise<Record<string, unknown>> {
    const qs = new URLSearchParams(params).toString();
    const url = `${this.baseUrl}${apiPath}${qs ? '?' + qs : ''}`;

    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: { 'User-Agent': 'bitso-cli/0.1.0' },
      });
    } catch (err) {
      throw new BitsoApiError(mapBitsoError(null, (err as Error).message, 0));
    }

    return unwrapEnvelope(response);
  }
}
