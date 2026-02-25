# Diavgeia API Guide

Reference documentation for integrating with the Greek Government Transparency Portal (Diavgeia). Over 71 million decisions are published through this system.

## API Basics

**Base URLs:**
- Production: `https://diavgeia.gov.gr/luminapi/opendata`
- Alternative: `https://opendata.diavgeia.gov.gr/luminapi/opendata`
- Test: `https://test3.diavgeia.gov.gr/luminapi/opendata`

**Important:** The search endpoint uses a different base path: `https://diavgeia.gov.gr/opendata/search` (without `/luminapi`). The `diavgeia-cli` client handles this routing transparently.

**Authentication:** None required for reads. Write operations (submit, edit, revoke) require HTTP Basic auth.

**Response format:** JSON (append `.json` to endpoints) or XML (append `.xml`). Max page size: 500.

**Official documentation:** https://diavgeia.gov.gr/api/help

## Key Concepts

### ADA (Αριθμός Διαδικτυακής Ανάρτησης)

Unique decision identifier assigned when published to Diavgeia. Format uses Greek uppercase letters and numbers (e.g., `ΨΘ82ΩΡΦ-7ΑΙ`, `624ΙΩΡΦ-ΥΕΨ`).

### Organization vs Unit

- **Organization (org):** The municipality or government body (e.g., `6104` for Δήμος Ζωγράφου)
- **Unit:** A department within the organization (e.g., `81689` for ΔΗΜΟΤΙΚΟ ΣΥΜΒΟΥΛΙΟ)

Unit filtering is critical for getting relevant results. Unit IDs are organization-specific — always query `/organizations/{orgId}/units` first.

### Protocol Number

Internal reference number assigned at meetings. Format: `N/YYYY` (e.g., `258/2024`). Numbers are sequential within each unit and reset annually. Protocol numbers are not globally unique.

### Signers

Officials authorized to sign decisions. Each signer is linked to one or more units with a specific position (e.g., Mayor, Committee Chair). Decisions include `signerIds` referencing these officials.

### Extra Field Values

Every decision type defines type-specific structured metadata via `extraFieldValues`. For example, budget approvals include `financialYear` and `budgettype`; regulatory acts include FEK references. Discover the schema via `GET /types/{typeId}/details`.

### Version History

Decisions can be corrected after publication. Each version gets a `versionId`; corrected versions point to their predecessor via `correctedVersionId`. The full chain is available at `GET /decisions/{ADA}/versionlog`.

## Endpoints

### Organizations

| Endpoint | Description |
|----------|-------------|
| `GET /organizations` | List/filter organizations. Params: `status` (`active`/`inactive`/`pending`/`all`), `category` (from `ORG_CATEGORY` dictionary, e.g. `MUNICIPALITY`) |
| `GET /organizations/{org}` | Single organization by UID or latinName (e.g., `6104` or `dzografou`) |
| `GET /organizations/{org}/details` | Organization with all nested data: units, signers, positions, supervised orgs |
| `GET /organizations/{org}/units` | List units. Param: `descendants` (`children` or `all` for hierarchy) |
| `GET /organizations/{org}/signers` | All authorized signers for the organization |
| `GET /organizations/{org}/positions` | All position types defined for the organization |

### Decisions

| Endpoint | Description |
|----------|-------------|
| `GET /decisions/{ADA}` | Single decision by ADA |
| `GET /decisions/v/{versionId}` | Specific version of a decision by UUID |
| `GET /decisions/{ADA}/versionlog` | Full edit/correction history |

### Search

| Endpoint | Description |
|----------|-------------|
| `GET /search` | Simple search with named parameters (see table below) |
| `GET /search/advanced?q={lucene}` | Advanced search with Lucene query syntax |
| `GET /search/terms` | List all 86 searchable fields |
| `GET /search/terms/common` | List 21 most-used search fields |

**Note:** Search endpoints use the `/opendata` base path, not `/luminapi/opendata`.

**Simple search parameters:**

| Parameter | Description | Example |
|-----------|-------------|---------|
| `org` | Organization UID | `6104` |
| `unit` | Unit UID | `81689` |
| `from_issue_date` | Start issue date (ISO) | `2024-12-01` |
| `to_issue_date` | End issue date (ISO) | `2024-12-31` |
| `from_date` | Start submission date | `2024-12-01` |
| `to_date` | End submission date | `2024-12-31` |
| `status` | Decision status | `PUBLISHED` |
| `type` | Decision type UID | `Β.1.1` |
| `q` | Free-text keyword search | `προϋπολογισμού` |
| `subject` | Search by subject text | `ΕΓΚΡΙΣΗ` |
| `ada` | Search by specific ADA | `ΨΘ82ΩΡΦ-7ΑΙ` |
| `protocol` | Search by protocol number | `258/2024` |
| `signer` | Filter by signer UID | `100009559` |
| `tag` | Thematic category | `16` |
| `sort` | Sort order | `recent` (default) or `relative` |
| `page` | Page number (0-indexed) | `0` |
| `size` | Results per page (max 500) | `100` |

**Advanced search (Lucene syntax):**

```
GET /search/advanced?q=organizationUid:"6104" AND issueDate:[DT(2024-01-01T00:00:00) TO DT(2024-12-31T23:59:59)]
```

Key fields available only in advanced search: `content` (full PDF text), `amount`, `giverAFM`/`receiverAFM` (payer/payee tax ID), `cpv` (procurement codes), `financialYear`, `municipality`, `relatedDecisionsADA`, `publishTimestamp`.

### Reference Data

| Endpoint | Description |
|----------|-------------|
| `GET /types` | Full decision type taxonomy (hierarchical) |
| `GET /types/{typeId}/details` | Decision type with its extra field definitions |
| `GET /dictionaries` | List all 20 dictionaries |
| `GET /dictionaries/{name}` | Get items in a specific dictionary |
| `GET /positions` | All position types system-wide (142 positions) |
| `GET /units/{unitId}` | Single unit by ID |
| `GET /signers/{signerId}` | Single signer by ID |

## Data Models

### Organization

| Field | Type | Description |
|-------|------|-------------|
| `uid` | string | Numeric identifier |
| `label` | string | Greek name |
| `abbreviation` | string | Short name |
| `latinName` | string | Latin/ASCII name (usable as API identifier) |
| `status` | string | `active`, `inactive`, `pending` |
| `category` | string | From `ORG_CATEGORY` dictionary |
| `vatNumber` | string | Tax identification number (AFM) |
| `fekNumber` | string | Government Gazette establishment number |
| `fekIssue` | string | FEK issue type |
| `fekYear` | string | FEK publication year |
| `odeManagerEmail` | string | Organization admin email |
| `website` | string | Organization website URL |
| `supervisorId` | string | UID of supervisory organization |
| `supervisorLabel` | string | Name of supervisory organization |
| `organizationDomains` | string[] | Competency domains |

The details endpoint (`/organizations/{org}/details`) additionally returns `units`, `signers`, `positions`, and `supervisedOrganizations`.

### Unit

| Field | Type | Description |
|-------|------|-------------|
| `uid` | string | Unique identifier |
| `label` | string | Greek name |
| `abbreviation` | string | Short name |
| `active` | boolean | Whether currently active |
| `activeFrom` | datetime | Activation date |
| `activeUntil` | datetime | Deactivation date (null if active) |
| `category` | string | From `ORG_UNIT_CATEGORY` dictionary (25 types) |
| `unitDomains` | string[] | Competency domains |
| `parentId` | string | Parent unit UID (hierarchical structure) |

### Decision

| Field | Type | Description |
|-------|------|-------------|
| `ada` | string | Unique identifier, used in URLs |
| `subject` | string | Decision title (Greek text) |
| `protocolNumber` | string | Format varies: `N/YYYY`, `Α/1522`, `38586` |
| `issueDate` | number | **Milliseconds timestamp** (not ISO string!) |
| `publishTimestamp` | number | When published to Diavgeia (ms) |
| `submissionTimestamp` | number | When last submitted/modified (ms) |
| `organizationId` | string | Organization UID |
| `unitIds` | string[] | May contain multiple units |
| `signerIds` | string[] | UIDs of signing officials |
| `decisionTypeId` | string | Decision type UID (e.g., `Β.1.1`) |
| `thematicCategoryIds` | string[] | Thematic category codes |
| `extraFieldValues` | object | Type-specific structured metadata |
| `status` | string | `PUBLISHED`, `REVOKED` |
| `versionId` | string | UUID of this version |
| `correctedVersionId` | string? | UUID of the version this corrects |
| `documentUrl` | string | Direct link to PDF |
| `documentChecksum` | string? | Checksum of the PDF |
| `url` | string | API URL to the decision |
| `attachments` | Attachment[] | Supplementary files |
| `privateData` | boolean | Contains personal data |

**Attachment fields:** `id`, `description`, `filename`, `mimeType`, `checksum`

**Extra field examples by decision type:**

Budget Approval (`Β.1.1`):
```json
{ "financialYear": 2024, "budgettype": "Τακτικός Προϋπολογισμός", "budgetkind": "Φορέα", "documentType": "ΠΡΑΞΗ" }
```

Regulatory Act (`Α.2`):
```json
{ "fek": {}, "kanonistikipraxiaa": "239", "kanonistikipraxitype": "Πράξη Οργάνου Διοίκησης ΟΤΑ...", "documentType": "ΠΡΑΞΗ" }
```

### Signer

| Field | Type | Description |
|-------|------|-------------|
| `uid` | string | Unique signer identifier |
| `firstName` | string | First name |
| `lastName` | string | Last name |
| `active` | boolean | Whether currently active |
| `activeFrom` | datetime | Start of active period |
| `activeUntil` | datetime | End of active period (null if active) |
| `organizationId` | string | Organization they belong to |
| `hasOrganizationSignRights` | boolean | Can sign for the entire organization |
| `units` | SignerUnit[] | Unit assignments with position |

**SignerUnit fields:** `uid` (unit UID), `positionId` (e.g., `POS_10091` = Mayor), `positionLabel` (human-readable)

### Search Response

```json
{
  "info": {
    "total": 132,
    "page": 0,
    "size": 100,
    "actualSize": 100,
    "query": "organizationUid:\"6104\" AND ..."
  },
  "decisions": [...]
}
```

## Dictionaries

20 reference dictionaries available via `GET /dictionaries/{name}`:

| Dictionary | Description | Use Case |
|------------|-------------|----------|
| `ADMIN_STRUCTURE_KALLIKRATIS` | Kallikratis administrative structure | Hierarchical region→municipality mapping (has `parent` field) |
| `ORG_CATEGORY` | Organization categories (22) | Filter orgs: `MUNICIPALITY`, `MINISTRY`, `UNIVERSITY`, `HOSPITAL`... |
| `ORG_UNIT_CATEGORY` | Unit categories (25) | `DEPARTMENT`, `OFFICE`, `COMMITTEE`, `ORG_UNIT_OTHER`... |
| `THK` | Thematic categories (25) | Classifying decisions: ΟΙΚΟΝΟΜΙΚΗ ΖΩΗ, ΔΗΜΟΣΙΑ ΔΙΟΙΚΗΣΗ... |
| `ORG_DOMAIN` | Organization domains | Fields of competency |
| `CPV` | Common Procurement Vocabulary | Procurement classification codes |
| `CURRENCY` | Currencies | Currency codes for financial decisions |
| `EE_MEMBER` | EU Member States | EU member state list |
| `FEKTYPES` | FEK issue types | Government Gazette issue type codes |
| `KANONISTIKI_PRAXI_TYPE` | Regulatory act types | Types of regulatory acts |
| `XOROTAXIKI_PRAXI_TYPE` | Urban planning act types | Types of urban planning acts |
| `PUBLIC_DOC_TYPES` | Public document types | Standard document type codes |
| `VAT_TYPE` | VAT types | Tax identification number types |
| `REVOCATION_REASON` | Revocation reasons | Standard reasons for revoking decisions |
| `LAW_EXCEPTION` | Law exceptions | Exceptions per Article 5 of Law 3861/2010 |
| `FA` | Flagging actions | Management actions for flagged decisions |
| `FE` | Flagging reasons | Reasons for flagging decisions |
| `NO_VAT_ORGS` | Organizations without VAT | Organizations that lack a VAT number |
| `SKIP_VAT_REASON` | Skip VAT reasons | Reasons for omitting multiple VAT entries |

The `ADMIN_STRUCTURE_KALLIKRATIS` dictionary is especially useful — each municipality entry has a `parent` field pointing to its region.

## Decision Types

Hierarchical taxonomy with 8 root categories and 30+ leaf types. Key types:

| UID | Label | Description |
|-----|-------|-------------|
| `2.4.7.1` | ΛΟΙΠΕΣ ΑΤΟΜΙΚΕΣ ΔΙΟΙΚΗΤΙΚΕΣ ΠΡΑΞΕΙΣ | Common catch-all for council decisions |
| `Α.2` | ΚΑΝΟΝΙΣΤΙΚΗ ΠΡΑΞΗ | Regulatory acts |
| `Β.1.1` | ΕΓΚΡΙΣΗ ΠΡΟΥΠΟΛΟΓΙΣΜΟΥ | Budget approval |
| `Β.2.2` | ΟΡΙΣΤΙΚΟΠΟΙΗΣΗ ΠΛΗΡΩΜΗΣ | Payment finalization (high volume) |
| `Β.1.3` | ΑΝΑΛΗΨΗ ΥΠΟΧΡΕΩΣΗΣ | Budget commitment |
| `Γ.2` | ΠΡΑΞΗ ΣΥΛΛΟΓΙΚΟΥ ΟΡΓΑΝΟΥ | Collective body acts |
| `Δ.1` | ΑΝΑΘΕΣΗ ΕΡΓΩΝ/ΠΡΟΜΗΘΕΙΩΝ | Contract awards |
| `Δ.2.1` | ΠΕΡΙΛΗΨΗ ΔΙΑΚΗΡΥΞΗΣ | Tender announcements |

Each decision type defines its own `extraFieldValues` schema. Use `GET /types/{typeId}/details` to discover the schema.

## Common Gotchas

1. **`issueDate` is milliseconds**, not ISO string
   ```typescript
   import { msToISODate } from 'diavgeia-cli';
   const isoDate = msToISODate(decision.issueDate); // "2024-12-19"
   ```

2. **Dual base paths** — Structural endpoints use `/luminapi/opendata`, search uses `/opendata`. The client handles this automatically.

3. **`publishTimestamp` vs `issueDate`** — `issueDate` is when the decision was issued; `publishTimestamp` is when it was uploaded to Diavgeia. They can differ by days or weeks.

4. **Unit IDs vary per organization** — always query `/organizations/{orgId}/units` first for a new municipality.

5. **The `q` parameter** searches broadly — may match partial words.

6. **Protocol numbers are not globally unique** — different units have separate numbering sequences.

7. **Greek text normalization** — when matching subjects, account for:
   - Word inflection (different endings for same word)
   - Quote styles: `«»` (Greek) vs `""` (standard)
   - Final sigma: `Σ` lowercases to `ς` (word-final) vs `σ` (mid-word)

8. **Empty subjects** — some administrative decisions have minimal or formulaic subjects.

9. **`extraFieldValues` vary by decision type** — always check `GET /types/{typeId}/details` for the schema.

10. **Publication timing** — decisions are published after events, not before. Typical delay: same week to 2 weeks, occasionally up to 45 days.

## References

- **Official API docs:** https://diavgeia.gov.gr/api/help
- **Official samples:** [Java](https://github.com/diavgeia/opendata-client-samples-java), [Python](https://github.com/diavgeia/opendata-client-samples-python), [PHP](https://github.com/diavgeia/opendata-client-samples-php)
- **MEF API:** https://mef.diavgeia.gov.gr/api/ — subsidized organization spending data
