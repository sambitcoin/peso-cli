#!/usr/bin/env node
import { Command } from 'commander';
import { registerBitsoCommand } from './brokers/bitso.js';
import { registerGbmCommand } from './brokers/gbm.js';
import { registerAggregatePositionsCommand } from './commands/aggregate-balance.js';
import { registerAggregateOrderListCommand } from './commands/aggregate-orders.js';

const program = new Command('peso')
  .description(
    'peso — multi-broker trading CLI.\n\n' +
    'Top-level commands:\n' +
    '  peso positions [asset]   Aggregated positions from all brokers\n' +
    '  peso order list          Aggregated open orders from all brokers\n\n' +
    'Broker commands:\n' +
    '  peso bitso [command]     Trade on Bitso (LATAM crypto exchange)\n' +
    '  peso gbm   [command]     Trade on GBM (coming soon)\n\n' +
    'Run `peso <broker> --help` for broker-specific commands.'
  )
  .version('0.1.0', '-V, --version');

registerAggregatePositionsCommand(program);
registerAggregateOrderListCommand(program);
registerBitsoCommand(program);
registerGbmCommand(program);

program.parse(process.argv);
