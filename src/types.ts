/**
 * Type definitions for the Diavgeia API.
 *
 * All types match the raw API response shapes. Timestamps are milliseconds
 * since epoch (use msToDate/msToISODate from utils.ts to convert).
 */

// --- Organizations ---

export interface Organization {
  uid: string;
  label: string;
  abbreviation: string;
  latinName: string;
  status: string;
  category: string;
  vatNumber: string;
  fekNumber: string;
  fekIssue: string;
  fekYear: string;
  odeManagerEmail: string;
  website: string;
  supervisorId: string;
  supervisorLabel: string;
  organizationDomains: string[];
}

export interface OrganizationDetails extends Organization {
  units: Unit[];
  signers: Signer[];
  positions: Position[];
  supervisedOrganizations: Organization[];
}

// --- Units ---

export interface Unit {
  uid: string;
  label: string;
  abbreviation: string;
  active: boolean;
  activeFrom: string | null;
  activeUntil: string | null;
  category: string;
  unitDomains: string[];
  parentId: string | null;
}

// --- Signers ---

export interface SignerUnit {
  uid: string;
  positionId: string;
  positionLabel: string;
}

export interface Signer {
  uid: string;
  firstName: string;
  lastName: string;
  active: boolean;
  activeFrom: string | null;
  activeUntil: string | null;
  organizationId: string;
  hasOrganizationSignRights: boolean;
  units: SignerUnit[];
}

// --- Positions ---

export interface Position {
  uid: string;
  label: string;
}

// --- Decisions ---

export interface Attachment {
  id: string;
  description: string;
  filename: string;
  mimeType: string;
  checksum: string;
}

export interface Decision {
  ada: string;
  subject: string;
  protocolNumber: string;
  issueDate: number;
  publishTimestamp: number;
  submissionTimestamp: number;
  organizationId: string;
  unitIds: string[];
  signerIds: string[];
  decisionTypeId: string;
  thematicCategoryIds: string[];
  extraFieldValues: Record<string, unknown>;
  status: string;
  versionId: string;
  correctedVersionId: string | null;
  documentUrl: string;
  documentChecksum: string | null;
  url: string;
  attachments: Attachment[];
  privateData: boolean;
}

// --- Version log ---

export interface VersionLogEntry {
  versionId: string;
  creator: string;
  versionTimestamp: number;
  description: string | null;
  status: string;
  correctedVersionId: string | null;
}

// --- Search ---

export interface SearchInfo {
  total: number;
  page: number;
  size: number;
  actualSize: number;
  query: string;
}

export interface SearchResponse {
  info: SearchInfo;
  decisions: Decision[];
}

export interface SearchParams {
  org?: string;
  unit?: string;
  from_issue_date?: string;
  to_issue_date?: string;
  from_date?: string;
  to_date?: string;
  status?: string;
  type?: string;
  q?: string;
  subject?: string;
  ada?: string;
  protocol?: string;
  signer?: string;
  tag?: string;
  sort?: 'recent' | 'relative';
  page?: number;
  size?: number;
}

// --- Search terms ---

export interface Term {
  term: string;
  label: string;
}

// --- Reference data ---

export interface DecisionType {
  uid: string;
  label: string;
  parent: string | null;
  children: DecisionType[];
}

export interface ExtraFieldDefinition {
  uid: string;
  label: string;
  type: string;
  required: boolean;
  dictionaryName: string | null;
}

export interface DecisionTypeDetails {
  uid: string;
  label: string;
  parent: string | null;
  allowedInOrgs: string[];
  extraFields: ExtraFieldDefinition[];
}

export interface Dictionary {
  uid: string;
  label: string;
}

export interface DictionaryItem {
  uid: string;
  label: string;
  parent: string | null;
}
