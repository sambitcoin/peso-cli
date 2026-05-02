import { Command } from 'commander';
import { printError } from '../output.js';

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

// Commander passes (arg1?, arg2?, ..., opts, cmd) — opts is always second-to-last.
function ni() {
  return (...args: unknown[]) => {
    const opts = args[args.length - 2] as { output?: string };
    notImplemented(opts?.output?.toLowerCase() === 'json');
  };
}

function leaf(cmd: Command): Command {
  return cmd
    .option('-o, --output <format>', 'Output format: table (default) or json.', 'table')
    .allowUnknownOption(true)
    .allowExcessArguments(true);
}

export function registerGbmCommand(program: Command): void {
  const gbm = program
    .command('gbm')
    .description('Trade on GBM (coming soon).');
  gbm.action(() => { gbm.help(); });

  // ticker
  leaf(gbm.command('ticker [coin]').description('Get the current price of a coin.')).action(ni());

  // orderbook
  leaf(gbm.command('orderbook [book]').description('View the order book.')).action(ni());

  // balance
  leaf(gbm.command('balance').description('Show account balances.')).action(ni());

  // order
  const order = gbm.command('order').description('Place or manage orders.');
  order.action(() => { order.help(); });
  leaf(order.command('buy [book]').description('Place a buy order.')).action(ni());
  leaf(order.command('sell [book]').description('Place a sell order.')).action(ni());
  leaf(order.command('list').description('List open orders.')).action(ni());
  leaf(order.command('cancel [oid]').description('Cancel an open order.')).action(ni());

  // auth
  const auth = gbm.command('auth').description('Manage GBM credentials.');
  auth.action(() => { auth.help(); });
  const authSet = auth.command('set').description('Configure GBM credentials.');
  authSet.action(() => { authSet.help(); });
  leaf(authSet.command('login').description('Log in with your GBM username and password.')).action(ni());
  leaf(auth.command('test').description('Verify credentials.')).action(ni());

  // quote
  const quote = gbm.command('quote').description('Request or execute a conversion quote.');
  quote.action(() => { quote.help(); });
  leaf(quote.command('request').description('Request a conversion quote.')).action(ni());
  leaf(quote.command('execute [quote_id]').description('Execute a conversion quote.')).action(ni());
}
