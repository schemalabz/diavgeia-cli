import { Command } from 'commander';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
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

  decisions
    .command('download <ada...>')
    .description('Download decision documents (PDFs)')
    .option('-o, --output <dir>', 'Output directory', '.')
    .option('--skip-existing', 'Skip if file already exists')
    .action(async (adas: string[], opts) => {
      try {
        const dir = opts.output as string;
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }

        for (const ada of adas) {
          const filePath = join(dir, `${ada}.pdf`);

          if (opts.skipExisting && existsSync(filePath)) {
            if (process.stderr.isTTY) {
              process.stderr.write(`Skipping ${ada} (already exists)\n`);
            }
            continue;
          }

          if (process.stderr.isTTY) {
            process.stderr.write(`Downloading ${ada}...`);
          }

          const { buffer } = await client.downloadDocument(ada);
          writeFileSync(filePath, Buffer.from(buffer));

          if (process.stderr.isTTY) {
            process.stderr.write(` saved to ${filePath}\n`);
          }
        }
      } catch (err) {
        handleError(err);
      }
    });
}
