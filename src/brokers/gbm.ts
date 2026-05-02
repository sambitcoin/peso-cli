import { Command } from 'commander';
import { JsonOutput, printError } from '../output.js';

function notImplemented(isJson: boolean): never {
  printError({
    category: 'not_implemented',
    code: 'not_implemented',
    message: 'GBM support is not yet implemented.',
    suggestion: 'Check back in a future release.',
    retryable: false,
    docs_url: '',
  }, isJson);
  process.exit(1);
}

export function registerGbmCommand(program: Command): void {
  const gbm = program
    .command('gbm')
    .description('Trade on GBM (coming soon).');

  gbm.action(() => { gbm.help(); });

  const auth = gbm.command('auth').description('Manage GBM credentials.');
  auth.action(() => { auth.help(); });

  const authSet = auth.command('set').description('Configure GBM credentials.');
  authSet.action(() => { authSet.help(); });

  authSet
    .command('login')
    .description('Log in with your GBM username and password.')
    .option('-o, --output <format>', 'Output format: table (default) or json.', 'table')
    .action((opts: { output: string }) => {
      notImplemented(opts.output.toLowerCase() === 'json');
    });
}
