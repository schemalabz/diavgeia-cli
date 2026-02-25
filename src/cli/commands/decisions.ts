import { Command } from 'commander';
import type { Diavgeia } from '../../client.js';
import { output, formatDecision, formatVersionLog, handleError } from './output.js';

export function registerDecisionsCommand(program: Command, client: Diavgeia): void {
  const decisions = program
    .command('decisions')
    .description('Fetch and inspect decisions');

  decisions
    .command('get <ada>')
    .description('Get a decision by ADA')
    .action(async (ada: string) => {
      try {
        const result = await client.decision(ada);
        output(result, (data) => formatDecision(data as typeof result));
      } catch (err) {
        handleError(err);
      }
    });

  decisions
    .command('version <versionId>')
    .description('Get a specific version of a decision')
    .action(async (versionId: string) => {
      try {
        const result = await client.decisionVersion(versionId);
        output(result, (data) => formatDecision(data as typeof result));
      } catch (err) {
        handleError(err);
      }
    });

  decisions
    .command('history <ada>')
    .description('Get version history for a decision')
    .action(async (ada: string) => {
      try {
        const result = await client.versionLog(ada);
        output(result, (data) => formatVersionLog(data as typeof result));
      } catch (err) {
        handleError(err);
      }
    });
}
