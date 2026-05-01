#!/usr/bin/env node
import { Command } from 'commander';
import { registerTickerCommand } from './commands/ticker.js';
import { registerOrderBookCommand } from './commands/orderbook.js';
import { registerBalanceCommand } from './commands/balance.js';
import { registerOrderCommand } from './commands/order.js';
import { registerAuthCommand } from './commands/auth.js';

const program = new Command('bitso')
  .description(
    'AI-native trading CLI for Bitso — LATAM\'s largest crypto exchange.\n\n' +
    'Commands:\n' +
    '  Public (no auth required):\n' +
    '    bitso ticker <coin>       Get coin price in USD (btc, eth, sol)\n' +
    '    bitso orderbook <book>    View order book bids and asks\n\n' +
    '  Authenticated (API keys required):\n' +
    '    bitso balance              Show account balances\n' +
    '    bitso order buy <book>    Place a buy order\n' +
    '    bitso order sell <book>   Place a sell order\n' +
    '    bitso order list          List open orders\n' +
    '    bitso auth set            Configure API credentials\n' +
    '    bitso auth test           Verify credentials work\n\n' +
    'Output:\n' +
    '  Default output is JSON (for agents). Use -o table for humans.\n' +
    '  stderr is diagnostics only. Parse stdout for data.\n\n' +
    'Credentials:\n' +
    '  Precedence: --api-key/--api-secret-stdin > BITSO_API_KEY/BITSO_API_SECRET env\n' +
    '  vars > ~/.config/bitso/config.toml.\n' +
    '  Use --api-secret-stdin to keep secrets out of process listings.\n\n' +
    'Documentation: https://github.com/sambitcoin/bitso-cli'
  )
  .version('0.1.0', '-V, --version');

registerTickerCommand(program);
registerOrderBookCommand(program);
registerBalanceCommand(program);
registerOrderCommand(program);
registerAuthCommand(program);

program.parse(process.argv);
