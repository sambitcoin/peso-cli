#!/usr/bin/env node
import { Command } from 'commander';
import { registerBitsoCommand } from './brokers/bitso.js';
import { registerGbmCommand } from './brokers/gbm.js';

const program = new Command('peso')
  .description(
    'peso — multi-broker trading CLI.\n\n' +
    'Brokers:\n' +
    '  peso bitso [command]   Trade on Bitso (LATAM crypto exchange)\n' +
    '  peso gbm   [command]   Trade on GBM (coming soon)\n\n' +
    'Run `peso <broker> --help` for broker-specific commands.'
  )
  .version('0.1.0', '-V, --version');

registerBitsoCommand(program);
registerGbmCommand(program);

program.parse(process.argv);
