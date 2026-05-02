import { Command } from 'commander';
import { registerTickerCommand } from '../commands/ticker.js';
import { registerOrderBookCommand } from '../commands/orderbook.js';
import { registerBalanceCommand } from '../commands/balance.js';
import { registerOrderCommand } from '../commands/order.js';
import { registerAuthCommand } from '../commands/auth.js';
import { registerQuoteCommand } from '../commands/quote.js';

export function registerBitsoCommand(program: Command): void {
  const bitso = program
    .command('bitso')
    .description("Trade on Bitso — LATAM's largest crypto exchange.")
    .option('--stage', 'Use Bitso staging environment (https://stage.bitso.com).');

  bitso.action(() => { bitso.help(); });

  registerTickerCommand(bitso);
  registerOrderBookCommand(bitso);
  registerBalanceCommand(bitso);
  registerOrderCommand(bitso);
  registerAuthCommand(bitso);
  registerQuoteCommand(bitso);
}
