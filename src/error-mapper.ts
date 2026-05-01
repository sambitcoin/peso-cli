import type { BitsoError } from './types.js';

export function mapBitsoError(
  bitsoCode: string | null | undefined,
  bitsoMessage: string | null | undefined,
  httpStatus: number
): BitsoError {
  switch (bitsoCode) {
    case '0201':
      return {
        category: 'auth',
        code: 'invalid_credentials',
        message: bitsoMessage ?? 'API key or secret is invalid.',
        suggestion: "Run 'bitso auth test' to verify. Regenerate keys at https://bitso.com/settings/api-keys.",
        retryable: false,
        docs_url: 'https://docs.bitso.com/bitso-api/docs/authentication',
      };
    case '0206':
      return {
        category: 'auth',
        code: 'nonce_expired',
        message: bitsoMessage ?? 'Nonce must be monotonically increasing.',
        suggestion: 'Clock skew detected. Ensure your system clock is synced (NTP). The CLI will retry automatically.',
        retryable: false,
        docs_url: 'https://docs.bitso.com/bitso-api/docs/authentication',
      };
    case '0301':
      return {
        category: 'validation',
        code: 'unknown_book',
        message: bitsoMessage ?? 'Unknown order book.',
        suggestion: "Supported books include btc_usdc, eth_usdc, sol_usdc. Run 'bitso orderbook <book>' to verify.",
        retryable: false,
        docs_url: 'https://docs.bitso.com/bitso-api/docs/list-order-book',
      };
    case '0303':
      return {
        category: 'validation',
        code: 'invalid_amount',
        message: bitsoMessage ?? 'Invalid amount or format.',
        suggestion: "Amount must be a positive number. Use '--major' for fiat amount, '--minor' for crypto amount.",
        retryable: false,
        docs_url: '',
      };
    case '0304':
      return {
        category: 'validation',
        code: 'invalid_price',
        message: bitsoMessage ?? 'Invalid price.',
        suggestion: '',
        retryable: false,
        docs_url: '',
      };
    case '0379':
      return {
        category: 'validation',
        code: 'insufficient_balance',
        message: bitsoMessage ?? 'Insufficient balance.',
        suggestion: "Deposit funds or reduce order size. Check balances with 'bitso balance'.",
        retryable: false,
        docs_url: '',
      };
    case '0394':
      return {
        category: 'validation',
        code: 'order_too_small',
        message: bitsoMessage ?? 'Order amount below minimum.',
        suggestion: '',
        retryable: false,
        docs_url: '',
      };
    case '0501':
      return {
        category: 'validation',
        code: 'precision_error',
        message: bitsoMessage ?? 'Minor underflow / precision error.',
        suggestion: '',
        retryable: false,
        docs_url: '',
      };
    case '0401':
      return {
        category: 'rate_limit',
        code: 'rate_limited',
        message: bitsoMessage ?? 'Too many requests.',
        suggestion: 'Bitso public limit: 60 RPM/IP. Wait and retry.',
        retryable: true,
        docs_url: '',
      };
    default:
      if (httpStatus === 429) {
        return {
          category: 'rate_limit',
          code: 'rate_limited',
          message: 'Rate limited (HTTP 429).',
          suggestion: 'Wait and retry.',
          retryable: true,
          docs_url: '',
        };
      }
      if (httpStatus >= 500 && httpStatus <= 599) {
        return {
          category: 'network',
          code: 'http_5xx',
          message: bitsoMessage ?? `Bitso upstream error (HTTP ${httpStatus}).`,
          suggestion: 'Retry after a short delay.',
          retryable: true,
          docs_url: '',
        };
      }
      if (httpStatus === 0 || httpStatus < 0) {
        return {
          category: 'network',
          code: 'connection_failed',
          message: bitsoMessage ?? 'Could not connect to Bitso API.',
          suggestion: 'Check your network connection and try again.',
          retryable: true,
          docs_url: '',
        };
      }
      if (bitsoCode != null) {
        return {
          category: 'api',
          code: 'unknown_api_error',
          message: bitsoMessage ?? `Unexpected API error: ${bitsoCode}.`,
          suggestion: '',
          retryable: false,
          docs_url: '',
        };
      }
      return {
        category: 'api',
        code: 'unexpected_response',
        message: bitsoMessage ?? `Unexpected response from Bitso (HTTP ${httpStatus}).`,
        suggestion: '',
        retryable: false,
        docs_url: '',
      };
  }
}
