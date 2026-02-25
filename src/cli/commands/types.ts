import { Command } from 'commander';
import type { Diavgeia } from '../../client.js';
import {
  output,
  formatDecisionTypes,
  formatDictionaries,
  formatDictionaryItems,
  formatPositions,
  handleError,
} from './output.js';

export function registerTypesCommands(program: Command, client: Diavgeia): void {
  // --- types ---
  const types = program
    .command('types')
    .description('Decision types');

  types
    .command('list', { isDefault: true })
    .description('List all decision types')
    .action(async () => {
      try {
        const result = await client.decisionTypes();
        output(result, (data) => formatDecisionTypes(data as typeof result));
      } catch (err) {
        handleError(err);
      }
    });

  types
    .command('get <typeId>')
    .description('Get details for a decision type')
    .action(async (typeId: string) => {
      try {
        const result = await client.decisionTypeDetails(typeId);
        output(result);
      } catch (err) {
        handleError(err);
      }
    });

  // --- dictionaries ---
  const dicts = program
    .command('dictionaries')
    .description('Reference dictionaries');

  dicts
    .command('list', { isDefault: true })
    .description('List all dictionaries')
    .action(async () => {
      try {
        const result = await client.dictionaries();
        output(result, (data) => formatDictionaries(data as typeof result));
      } catch (err) {
        handleError(err);
      }
    });

  dicts
    .command('get <name>')
    .description('Get items in a dictionary')
    .action(async (name: string) => {
      try {
        const result = await client.dictionary(name);
        output(result, (data) => formatDictionaryItems(data as typeof result));
      } catch (err) {
        handleError(err);
      }
    });

  // --- positions ---
  program
    .command('positions')
    .description('List all position types')
    .action(async () => {
      try {
        const result = await client.positions();
        output(result, (data) => formatPositions(data as typeof result));
      } catch (err) {
        handleError(err);
      }
    });

  // --- direct lookups ---
  const units = program
    .command('units')
    .description('Unit lookups');

  units
    .command('get <unitId>')
    .description('Get a unit by ID')
    .action(async (unitId: string) => {
      try {
        const result = await client.unit(unitId);
        output(result);
      } catch (err) {
        handleError(err);
      }
    });

  const signers = program
    .command('signers')
    .description('Signer lookups');

  signers
    .command('get <signerId>')
    .description('Get a signer by ID')
    .action(async (signerId: string) => {
      try {
        const result = await client.signer(signerId);
        output(result);
      } catch (err) {
        handleError(err);
      }
    });
}
