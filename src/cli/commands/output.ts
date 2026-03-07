import type { Decision, Organization, Unit, Signer, Position, DecisionType, Dictionary, DictionaryItem, Term, VersionLogEntry } from '../../types.js';
import { msToISODate } from '../../utils.js';

/** Whether stdout is a TTY (interactive terminal) */
const isTTY = typeof process !== 'undefined' && process.stdout?.isTTY === true;

let forceJson = false;

export function setForceJson(value: boolean): void {
  forceJson = value;
}

export function shouldJson(): boolean {
  return forceJson || !isTTY;
}

/** Print data as JSON or human-readable format */
export function output(data: unknown, formatter?: (data: unknown) => string): void {
  if (shouldJson()) {
    console.log(JSON.stringify(data, null, 2));
  } else if (formatter) {
    console.log(formatter(data));
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

// --- Formatters ---

export function formatOrganizations(orgs: Organization[]): string {
  const lines = [`${orgs.length} organizations:\n`];
  for (const org of orgs) {
    lines.push(`  ${org.uid.padEnd(8)} ${org.label}`);
  }
  return lines.join('\n');
}

export function formatOrganization(org: Organization): string {
  const lines = [
    org.label,
    `  UID:          ${org.uid}`,
    `  Latin name:   ${org.latinName}`,
    `  Status:       ${org.status}`,
    `  Category:     ${org.category}`,
  ];
  if (org.abbreviation) lines.push(`  Abbreviation: ${org.abbreviation}`);
  if (org.website) lines.push(`  Website:      ${org.website}`);
  if (org.vatNumber) lines.push(`  VAT:          ${org.vatNumber}`);
  if (org.supervisorLabel) lines.push(`  Supervisor:   ${org.supervisorLabel}`);
  return lines.join('\n');
}

export function formatUnits(units: Unit[]): string {
  const lines = [`${units.length} units:\n`];
  for (const u of units) {
    const status = u.active ? '' : ' (inactive)';
    lines.push(`  ${u.uid.padEnd(12)} ${u.label}${status}`);
  }
  return lines.join('\n');
}

export function formatSigners(signers: Signer[]): string {
  const lines = [`${signers.length} signers:\n`];
  for (const s of signers) {
    const status = s.active ? '' : ' (inactive)';
    const positions = s.units.map(u => u.positionLabel).join(', ');
    lines.push(`  ${s.uid.padEnd(12)} ${s.lastName} ${s.firstName}${status}`);
    if (positions) lines.push(`${''.padEnd(15)}${positions}`);
  }
  return lines.join('\n');
}

export function formatPositions(positions: Position[]): string {
  const lines = [`${positions.length} positions:\n`];
  for (const p of positions) {
    lines.push(`  ${p.uid.padEnd(12)} ${p.label}`);
  }
  return lines.join('\n');
}

export function formatDecision(d: Decision): string {
  const lines = [
    d.subject,
    `  ADA:          ${d.ada}`,
    `  Protocol:     ${d.protocolNumber}`,
    `  Issue date:   ${msToISODate(d.issueDate)}`,
    `  Published:    ${msToISODate(d.publishTimestamp)}`,
    `  Organization: ${d.organizationId}`,
    `  Units:        ${d.unitIds.join(', ')}`,
    `  Type:         ${d.decisionTypeId}`,
    `  Status:       ${d.status}`,
    `  Document:     ${d.documentUrl}`,
  ];
  if (d.signerIds.length > 0) {
    lines.push(`  Signers:      ${d.signerIds.join(', ')}`);
  }
  if (d.correctedVersionId) {
    lines.push(`  Corrects:     ${d.correctedVersionId}`);
  }

  const extra = d.extraFieldValues;
  if (extra && Object.keys(extra).length > 0) {
    lines.push('');
    lines.push('  Extra fields:');

    // FEK info
    const fek = extra.fek as Record<string, unknown> | undefined;
    if (fek && (fek.aa || fek.issue || fek.issueyear)) {
      lines.push(`    FEK:        ${fek.aa ?? ''}/${fek.issue ?? ''}/${fek.issueyear ?? ''}`);
    }

    // Financial amount
    if (extra.financialAmount != null && extra.financialAmount !== '') {
      const amount = Number(extra.financialAmount);
      const formatted = isNaN(amount) ? String(extra.financialAmount) : amount.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      lines.push(`    Amount:     ${formatted}`);
    }

    // Other extra fields
    for (const [key, value] of Object.entries(extra)) {
      if (key === 'fek' || key === 'financialAmount') continue;
      if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) continue;
      if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0) continue;
      const display = typeof value === 'object' ? JSON.stringify(value) : String(value);
      lines.push(`    ${key}: ${display}`);
    }
  }

  return lines.join('\n');
}

export function formatSearchResults(decisions: Decision[], total: number, page: number): string {
  const lines = [`${total} results (page ${page}):\n`];
  for (const d of decisions) {
    lines.push(`  ${d.ada.padEnd(16)} ${msToISODate(d.issueDate)}  ${(d.decisionTypeId ?? '').padEnd(7)} ${d.subject.substring(0, 72)}`);
  }
  return lines.join('\n');
}

export function formatVersionLog(entries: VersionLogEntry[]): string {
  const lines = [`${entries.length} versions:\n`];
  for (const e of entries) {
    const corrected = e.correctedVersionId ? ` (corrects ${e.correctedVersionId})` : '';
    lines.push(`  ${e.versionId}  ${e.status}  ${msToISODate(e.versionTimestamp)}${corrected}`);
  }
  return lines.join('\n');
}

export function formatDecisionTypes(types: DecisionType[], indent = 0): string {
  const lines: string[] = [];
  for (const t of types) {
    lines.push(`${'  '.repeat(indent)}${t.uid.padEnd(12)} ${t.label}`);
    if (t.children?.length > 0) {
      lines.push(formatDecisionTypes(t.children, indent + 1));
    }
  }
  return lines.join('\n');
}

export function formatDictionaries(dicts: Dictionary[]): string {
  const lines = [`${dicts.length} dictionaries:\n`];
  for (const d of dicts) {
    lines.push(`  ${d.uid.padEnd(35)} ${d.label}`);
  }
  return lines.join('\n');
}

export function formatDictionaryItems(items: DictionaryItem[]): string {
  const lines = [`${items.length} items:\n`];
  for (const item of items) {
    const parent = item.parent ? ` (parent: ${item.parent})` : '';
    lines.push(`  ${item.uid.padEnd(12)} ${item.label}${parent}`);
  }
  return lines.join('\n');
}

export function formatTerms(terms: Term[]): string {
  const lines = [`${terms.length} search terms:\n`];
  for (const t of terms) {
    lines.push(`  ${t.term.padEnd(30)} ${t.label}`);
  }
  return lines.join('\n');
}

/** Handle CLI errors consistently */
export function handleError(err: unknown): never {
  if (err instanceof Error) {
    console.error(`Error: ${err.message}`);
  } else {
    console.error('Error:', err);
  }
  process.exit(1);
}
