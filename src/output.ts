import type {
  BitsoError,
  SuccessEnvelope,
  ErrorEnvelope,
  TickerResult,
  OrderBookResult,
  BalanceResult,
  OrderResult,
  OrderListResult,
  ValidateResult,
} from './types.js';

export const JsonOutput = {
  success<T>(result: T): string {
    const envelope: SuccessEnvelope<T> = { schema_version: '1.0', result };
    return JSON.stringify(envelope, null, 2);
  },
  error(err: BitsoError): string {
    const envelope: ErrorEnvelope = { schema_version: '1.0', error: err };
    return JSON.stringify(envelope, null, 2);
  },
};

function pad(s: string, n: number): string {
  return s.substring(0, n).padEnd(n);
}

export const TableOutput = {
  ticker(r: TickerResult): string {
    const lines: string[] = [];
    lines.push('  ┌──────────────┬───────────┬──────────┐');
    lines.push(`  │ ${pad('Coin', 12)} │ ${pad(r.coin.toUpperCase(), 9)} │ ${pad(r.currency.toUpperCase(), 8)} │`);
    lines.push('  ├──────────────┼───────────┼──────────┤');
    lines.push(`  │ ${pad('Book', 12)} │ ${pad(r.book, 9)} │          │`);
    lines.push(`  │ ${pad('Last', 12)} │ ${pad(r.last, 9)} │          │`);
    lines.push(`  │ ${pad('Bid', 12)} │ ${pad(r.bid, 9)} │          │`);
    lines.push(`  │ ${pad('Ask', 12)} │ ${pad(r.ask, 9)} │          │`);
    lines.push(`  │ ${pad('High', 12)} │ ${pad(r.high, 9)} │          │`);
    lines.push(`  │ ${pad('Low', 12)} │ ${pad(r.low, 9)} │          │`);
    lines.push(`  │ ${pad('Volume', 12)} │ ${pad(r.volume, 9)} │          │`);
    lines.push(`  │ ${pad('VWAP', 12)} │ ${pad(r.vwap, 9)} │          │`);
    if (r.fx != null) {
      lines.push('  ├──────────────┴───────────┴──────────┤');
      lines.push('  │ FX Conversion                        │');
      lines.push('  ├──────────────┬───────────────────────┤');
      lines.push(`  │ ${pad('Rate', 12)} │ ${pad(r.fx.rate, 21)} │`);
      lines.push(`  │ ${pad('Source', 12)} │ ${pad(r.fx.source, 21)} │`);
    }
    lines.push('  └──────────────┴───────────┴──────────┘');
    return lines.join('\n') + '\n';
  },

  orderBook(r: OrderBookResult, depth: number = Number.MAX_SAFE_INTEGER): string {
    const d = Math.min(depth, r.bids.length, r.asks.length);
    const lines: string[] = [];
    lines.push(`  Book: ${r.book}  Sequence: ${r.sequence}`);
    lines.push(`  Bids (${d}):`);
    lines.push(`  ${pad('Price', 14)}  ${'Amount'}`);
    lines.push(`  ──────────────  ─────────`);
    r.bids.slice(0, d).forEach(e => lines.push(`  ${pad(e.price, 14)}  ${e.amount}`));
    lines.push('');
    lines.push(`  Asks (${d}):`);
    lines.push(`  ${pad('Price', 14)}  ${'Amount'}`);
    lines.push(`  ──────────────  ─────────`);
    r.asks.slice(0, d).forEach(e => lines.push(`  ${pad(e.price, 14)}  ${e.amount}`));
    return lines.join('\n') + '\n';
  },

  balance(r: BalanceResult): string {
    const lines: string[] = [];
    lines.push(`  ${pad('Asset', 6)}  ${pad('Total', 14)}  ${pad('Available', 14)}  ${pad('Locked', 14)}`);
    lines.push(`  ${pad('──────', 6)}  ${pad('──────────────', 14)}  ${pad('──────────────', 14)}  ${pad('──────────────', 14)}`);
    r.balances.forEach(b => {
      lines.push(`  ${pad(b.currency.toUpperCase(), 6)}  ${pad(b.total, 14)}  ${pad(b.available, 14)}  ${pad(b.locked, 14)}`);
    });
    return lines.join('\n') + '\n';
  },

  order(r: OrderResult): string {
    const lines: string[] = [];
    lines.push(`  OID: ${r.oid}`);
    lines.push(`  Book: ${r.book}  Side: ${r.side}  Type: ${r.type}`);
    if (r.price != null) lines.push(`  Price: ${r.price}`);
    if (r.major != null) lines.push(`  Major: ${r.major}`);
    if (r.minor != null) lines.push(`  Minor: ${r.minor}`);
    lines.push(`  Status: ${r.status ?? 'unknown'}  Created: ${r.created_at ?? 'n/a'}`);
    return lines.join('\n') + '\n';
  },

  orderList(r: OrderListResult): string {
    const lines: string[] = [];
    if (r.orders.length === 0) {
      lines.push('  No open orders.');
    } else {
      lines.push(`  ${pad('OID', 14)}  ${pad('Book', 9)}  ${pad('Side', 4)}  ${pad('Type', 6)}  ${pad('Price', 12)}  ${pad('Amount', 14)}  ${'Status'}`);
      lines.push(`  ${pad('──────────────', 14)}  ${pad('─────────', 9)}  ${pad('────', 4)}  ${pad('──────', 6)}  ${pad('────────────', 12)}  ${pad('──────────────', 14)}  ${'────────'}`);
      r.orders.forEach(o => {
        const amt = o.major ?? o.minor ?? '-';
        lines.push(`  ${pad(o.oid, 14)}  ${pad(o.book, 9)}  ${pad(o.side, 4)}  ${pad(o.type, 6)}  ${pad(o.price ?? '-', 12)}  ${pad(amt, 14)}  ${o.status ?? '-'}`);
      });
    }
    return lines.join('\n') + '\n';
  },

  validate(r: ValidateResult): string {
    const lines: string[] = [];
    lines.push(`  Status: ${r.status}`);
    lines.push('  Would send:');
    lines.push(`    Book:  ${r.would_send.book}`);
    lines.push(`    Side:  ${r.would_send.side}`);
    lines.push(`    Type:  ${r.would_send.type}`);
    if (r.would_send.price != null) lines.push(`    Price: ${r.would_send.price}`);
    if (r.would_send.major != null) lines.push(`    Major: ${r.would_send.major}`);
    if (r.would_send.minor != null) lines.push(`    Minor: ${r.would_send.minor}`);
    return lines.join('\n') + '\n';
  },

  authTest(status: string): string {
    return `  Auth: ${status}`;
  },
};

export function printError(err: BitsoError, isJson: boolean): void {
  if (isJson) {
    console.log(JsonOutput.error(err));
  } else {
    process.stderr.write(`Error [${err.category}]: ${err.message}\n`);
    if (err.suggestion) {
      process.stderr.write(`Suggestion: ${err.suggestion}\n`);
    }
  }
}
