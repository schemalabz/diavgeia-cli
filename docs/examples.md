# Examples

Practical recipes for working with the Diavgeia API using `diavgeia-cli`.

## Find all municipalities

```typescript
import { Diavgeia } from 'diavgeia-cli';

const client = new Diavgeia();
const orgs = await client.organizations({ category: 'MUNICIPALITY' });

for (const org of orgs) {
  console.log(`${org.uid} ${org.label} (${org.latinName})`);
}
```

**CLI:**

```bash
diavgeia orgs list --category MUNICIPALITY
```

## Find council units for a municipality

Each municipality has different unit IDs. Always discover them via the API.

```typescript
const units = await client.units('6104'); // Δήμος Ζωγράφου
const council = units.find(u => u.label.includes('ΔΗΜΟΤΙΚΟ ΣΥΜΒΟΥΛΙΟ'));
console.log(`Council unit: ${council?.uid}`); // 81689
```

**CLI:**

```bash
diavgeia orgs units 6104
```

## Search council decisions for a date range

```typescript
import { Diavgeia, msToISODate } from 'diavgeia-cli';

const client = new Diavgeia();
const results = await client.search({
  org: '6104',
  unit: '81689',
  from_issue_date: '2024-12-01',
  to_issue_date: '2024-12-31',
  status: 'PUBLISHED',
});

console.log(`Found ${results.info.total} decisions`);
for (const d of results.decisions) {
  console.log(`${d.ada} ${msToISODate(d.issueDate)} ${d.subject}`);
}
```

**CLI:**

```bash
diavgeia search query --org 6104 --unit 81689 --from 2024-12-01 --to 2024-12-31 --status PUBLISHED
```

## Paginate through large result sets

For queries that return more than 500 results, use `searchAll()`:

```typescript
let count = 0;
for await (const decision of client.searchAll({ org: '6104', status: 'PUBLISHED' })) {
  count++;
  // Process each decision as it arrives
  console.log(decision.ada);
}
console.log(`Processed ${count} decisions total`);
```

You can also break early:

```typescript
const first10: Decision[] = [];
for await (const d of client.searchAll({ org: '6104' })) {
  first10.push(d);
  if (first10.length >= 10) break;
}
```

**CLI:**

```bash
# --all fetches all pages automatically
diavgeia search query --org 6104 --from 2024-01-01 --to 2024-12-31 --all
```

## Download decision PDFs

```typescript
import { writeFileSync } from 'node:fs';

const { buffer } = await client.downloadDocument('ΨΘ82ΩΡΦ-7ΑΙ');
writeFileSync('ΨΘ82ΩΡΦ-7ΑΙ.pdf', Buffer.from(buffer));
```

**CLI:**

```bash
# Download a single PDF
diavgeia decisions download ΨΘ82ΩΡΦ-7ΑΙ

# Download multiple PDFs to a directory, skipping already downloaded
diavgeia decisions download ΨΘ82ΩΡΦ-7ΑΙ Ψ123ΩΡΦ-ΑΒΓ -o ./pdfs --skip-existing
```

## Search by subject words

Use `--subject-words` for tokenized AND-matching. Unlike `--subject` (exact phrase), this finds decisions where all words appear in the subject independently, including word variations:

```typescript
const results = await client.searchAdvanced({
  q: 'subject:"δαπάνη" AND subject:"προμήθεια" AND organizationUid:"6104"',
});
```

**CLI:**

```bash
# Finds decisions with both words in the subject
diavgeia search query --subject-words "δαπάνη προμήθεια" --org 6104
```

## Search PDF content

Search within the text content of decision PDFs:

```typescript
const results = await client.searchAdvanced({
  q: 'content:"αποφασίζει" AND organizationUid:"6104"',
});
```

**CLI:**

```bash
diavgeia search query --content "αποφασίζει" --org 6104
```

## Filter by financial amount

Filter decisions by their financial amount using range queries:

```typescript
const results = await client.searchAdvanced({
  q: 'amount:[10000 TO 50000] AND organizationUid:"6104"',
});
```

**CLI:**

```bash
# Decisions between €10,000 and €50,000
diavgeia search query --amount-min 10000 --amount-max 50000 --org 6104

# Decisions over €100,000
diavgeia search query --amount-min 100000 --org 6104
```

## Get a decision PDF URL

```typescript
const decision = await client.decision('ΨΘ82ΩΡΦ-7ΑΙ');
console.log(decision.documentUrl);
// https://diavgeia.gov.gr/doc/ΨΘ82ΩΡΦ-7ΑΙ
```

## Greek text normalization for matching

Greek text has diacritics and the special final sigma (ς vs σ). Use `normalizeGreek` for case-insensitive matching:

```typescript
import { normalizeGreek } from 'diavgeia-cli';

const query = normalizeGreek('ζωγράφου');     // "ζωγραφου"
const label = normalizeGreek('ΔΗΜΟΣ ΖΩΓΡΑΦΟΥ'); // "δημος ζωγραφου"
console.log(label.includes(query)); // true
```

## Working with decision types and extra fields

Each decision type defines its own structured metadata schema:

```typescript
// Get the schema for budget approval decisions
const typeDetails = await client.decisionTypeDetails('Β.1.1');
console.log(typeDetails.extraFields);
// [{ uid: 'financialYear', label: '...', type: 'integer', required: true }, ...]

// Access extra fields on a decision
const decision = await client.decision('SOME-ADA');
console.log(decision.extraFieldValues.financialYear); // 2024
```

## Advanced search with Lucene queries

For queries that need fields not available in simple search (like full-text PDF content or financial amounts):

```typescript
const results = await client.searchAdvanced({
  q: 'organizationUid:"6104" AND content:"αποφασίζει"',
  size: 50,
});
```

**CLI:**

```bash
diavgeia search advanced 'organizationUid:"6104" AND content:"αποφασίζει"'
```

## Check version history for corrections

Decisions can be corrected after publication. Check if a decision has been modified:

```typescript
const log = await client.versionLog('ΨΘ82ΩΡΦ-7ΑΙ');
for (const entry of log) {
  console.log(`${entry.versionId} ${entry.status}`);
  if (entry.correctedVersionId) {
    console.log(`  Corrects: ${entry.correctedVersionId}`);
  }
}
```

## Pipe CLI output to jq

Since the CLI outputs JSON when piped, you can combine with `jq`:

```bash
# Get all municipality names and UIDs
diavgeia orgs list --category MUNICIPALITY | jq '.[] | {uid, label}'

# Get ADAs from search results
diavgeia search query --org 6104 --from 2024-12-01 --to 2024-12-31 | jq '.decisions[].ada'

# Count decisions per type
diavgeia search query --org 6104 --from 2024-01-01 --to 2024-12-31 --size 500 | \
  jq '[.decisions[].decisionTypeId] | group_by(.) | map({type: .[0], count: length})'
```

## Discover all reference dictionaries

```typescript
const dicts = await client.dictionaries();
for (const d of dicts) {
  const items = await client.dictionary(d.name);
  console.log(`${d.name}: ${items.length} items`);
}
```
