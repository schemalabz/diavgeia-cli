import { Command } from 'commander';
import type { Diavgeia } from '../../client.js';
import {
  output,
  formatOrganizations,
  formatOrganization,
  formatUnits,
  formatSigners,
  formatPositions,
  handleError,
} from './output.js';

export function registerOrgsCommand(program: Command, client: Diavgeia): void {
  const orgs = program
    .command('orgs')
    .description('List and inspect organizations');

  orgs
    .command('list', { isDefault: true })
    .description('List organizations')
    .option('--status <status>', 'Filter by status (active, inactive, pending, all)')
    .option('--category <category>', 'Filter by category (e.g. MUNICIPALITY)')
    .action(async (opts) => {
      try {
        const result = await client.organizations({
          status: opts.status,
          category: opts.category,
        });
        output(result, (data) => formatOrganizations(data as typeof result));
      } catch (err) {
        handleError(err);
      }
    });

  orgs
    .command('get <orgId>')
    .description('Get a single organization')
    .action(async (orgId: string) => {
      try {
        const result = await client.organization(orgId);
        output(result, (data) => formatOrganization(data as typeof result));
      } catch (err) {
        handleError(err);
      }
    });

  orgs
    .command('details <orgId>')
    .description('Get organization with all nested data')
    .action(async (orgId: string) => {
      try {
        const result = await client.organizationDetails(orgId);
        output(result);
      } catch (err) {
        handleError(err);
      }
    });

  orgs
    .command('units <orgId>')
    .description('List units for an organization')
    .option('--descendants <mode>', 'Include descendants (children or all)')
    .action(async (orgId: string, opts) => {
      try {
        const result = await client.units(orgId, {
          descendants: opts.descendants,
        });
        output(result, (data) => formatUnits(data as typeof result));
      } catch (err) {
        handleError(err);
      }
    });

  orgs
    .command('signers <orgId>')
    .description('List signers for an organization')
    .action(async (orgId: string) => {
      try {
        const result = await client.signers(orgId);
        output(result, (data) => formatSigners(data as typeof result));
      } catch (err) {
        handleError(err);
      }
    });

  orgs
    .command('positions <orgId>')
    .description('List positions for an organization')
    .action(async (orgId: string) => {
      try {
        const result = await client.orgPositions(orgId);
        output(result, (data) => formatPositions(data as typeof result));
      } catch (err) {
        handleError(err);
      }
    });
}
