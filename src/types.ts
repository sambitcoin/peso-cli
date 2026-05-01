export type ErrorCategory = 'auth' | 'rate_limit' | 'validation' | 'api' | 'network';

export interface BitsoError {
  category: ErrorCategory;
  code: string;
  message: string;
  suggestion: string;
  retryable: boolean;
  docs_url: string;
  details?: Record<string, unknown>;
}

export interface SuccessEnvelope<T> {
  schema_version: '1.0';
  result: T;
}

export interface ErrorEnvelope {
  schema_version: '1.0';
  error: BitsoError;
}

export interface FxInfo {
  rate: string;
  source: string;
  source_bid: string;
  source_ask: string;
  timestamp: string;
}

export interface TickerResult {
  coin: string;
  book: string;
  currency: string;
  last: string;
  bid: string;
  ask: string;
  high: string;
  low: string;
  volume: string;
  vwap: string;
  fx?: FxInfo;
}

export interface OrderBookEntry {
  price: string;
  amount: string;
}

export interface OrderBookResult {
  book: string;
  sequence: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

export interface BalanceEntry {
  currency: string;
  total: string;
  available: string;
  locked: string;
}

export interface BalanceResult {
  balances: BalanceEntry[];
}

export interface OrderResult {
  oid: string;
  book: string;
  side: string;
  type: string;
  price?: string;
  major?: string;
  minor?: string;
  created_at?: string;
  status?: string;
  filled?: string;
}

export interface OrderListResult {
  orders: OrderResult[];
}

export interface PlaceOrderRequest {
  book: string;
  side: string;
  type: string;
  major?: string;
  minor?: string;
  price?: string;
  client_id?: string;
}

export interface ValidateResult {
  status: 'valid';
  would_send: PlaceOrderRequest;
}
