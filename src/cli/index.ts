import { Command } from 'commander';
import { Diavgeia } from '../client.js';
import { setForceJson } from './commands/output.js';
import { registerOrgsCommand } from './commands/orgs.js';
import { registerDecisionsCommand } from './commands/decisions.js';
import { registerSearchCommand } from './commands/search.js';
import { registerTypesCommands } from './commands/types.js';

const program = new Command();

program
  .name('diavgeia')
  .description('CLI for the Diavgeia (Greek Government Transparency) API')
  .version('0.1.0')
  .option('--json', 'Force JSON output')
  .option('--base-url <url>', 'API base URL')
  .option('--timeout <ms>', 'Request timeout in milliseconds')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.json) {
      setForceJson(true);
    }
  });

// Create client lazily based on global options
function createClient(): Diavgeia {
  const opts = program.opts();
  return new Diavgeia({
    baseUrl: opts.baseUrl,
    timeout: opts.timeout ? parseInt(opts.timeout, 10) : undefined,
  });
}

// Register all commands
const client = createClient();
registerOrgsCommand(program, client);
registerDecisionsCommand(program, client);
registerSearchCommand(program, client);
registerTypesCommands(program, client);

program.parse();
