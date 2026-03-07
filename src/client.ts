import { DiavgeiaError, DiavgeiaTimeoutError } from './errors.js';
import { paginate } from './paginate.js';
import { buildUrl } from './utils.js';
import type {
  Organization,
  OrganizationDetails,
  Unit,
  Signer,
  Position,
  Decision,
  VersionLogEntry,
  SearchParams,
  SearchResponse,
  DecisionType,
  DecisionTypeDetails,
  Dictionary,
  DictionaryItem,
  Term,
} from './types.js';

const DEFAULT_BASE_URL = 'https://diavgeia.gov.gr';
const DEFAULT_TIMEOUT = 30000;

export interface DiavgeiaConfig {
  baseUrl?: string;
  timeout?: number;
  fetch?: typeof globalThis.fetch;
}

/**
 * Client for the Diavgeia (Greek Government Transparency) API.
 *
 * Covers all read endpoints: organizations, decisions, search, and reference data.
 * Uses two base paths internally: /luminapi/opendata for structural endpoints
 * and /opendata for search.
 */
export class Diavgeia {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly _fetch: typeof globalThis.fetch;

  constructor(config?: DiavgeiaConfig) {
    this.baseUrl = config?.baseUrl ?? DEFAULT_BASE_URL;
    this.timeout = config?.timeout ?? DEFAULT_TIMEOUT;
    this._fetch = config?.fetch ?? globalThis.fetch;
  }

  // --- Internal helpers ---

  private async request<T>(basePath: string, path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const url = buildUrl(this.baseUrl, `${basePath}${path}`, params);
    let response: Response;

    try {
      response = await this._fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeout),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        throw new DiavgeiaTimeoutError(url, this.timeout);
      }
      throw err;
    }

    if (!response.ok) {
      throw new DiavgeiaError(response.status, response.statusText, url);
    }

    return response.json() as Promise<T>;
  }

  /** Fetch from /luminapi/opendata (structural endpoints) */
  private api<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    return this.request<T>('/luminapi/opendata', path, params);
  }

  /** Fetch from /opendata (search endpoints) */
  private searchApi<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    return this.request<T>('/opendata', path, params);
  }

  // --- Organizations ---

  async organizations(params?: { status?: string; category?: string }): Promise<Organization[]> {
    const data = await this.api<{ organizations: Organization[] }>('/organizations.json', {
      status: params?.status,
      category: params?.category,
    });
    return data.organizations;
  }

  async organization(orgId: string): Promise<Organization> {
    return this.api<Organization>(`/organizations/${encodeURIComponent(orgId)}.json`);
  }

  async organizationDetails(orgId: string): Promise<OrganizationDetails> {
    return this.api<OrganizationDetails>(`/organizations/${encodeURIComponent(orgId)}/details.json`);
  }

  async units(orgId: string, params?: { descendants?: 'children' | 'all' }): Promise<Unit[]> {
    const data = await this.api<{ units: Unit[] }>(
      `/organizations/${encodeURIComponent(orgId)}/units.json`,
      { descendants: params?.descendants },
    );
    return data.units;
  }

  async signers(orgId: string): Promise<Signer[]> {
    const data = await this.api<{ signers: Signer[] }>(
      `/organizations/${encodeURIComponent(orgId)}/signers.json`,
    );
    return data.signers;
  }

  async orgPositions(orgId: string): Promise<Position[]> {
    const data = await this.api<{ positions: Position[] }>(
      `/organizations/${encodeURIComponent(orgId)}/positions.json`,
    );
    return data.positions;
  }

  // --- Direct lookups ---

  async unit(unitId: string): Promise<Unit> {
    return this.api<Unit>(`/units/${encodeURIComponent(unitId)}.json`);
  }

  async signer(signerId: string): Promise<Signer> {
    return this.api<Signer>(`/signers/${encodeURIComponent(signerId)}.json`);
  }

  // --- Decisions ---

  async decision(ada: string): Promise<Decision> {
    return this.api<Decision>(`/decisions/${encodeURIComponent(ada)}.json`);
  }

  async decisionVersion(versionId: string): Promise<Decision> {
    return this.api<Decision>(`/decisions/v/${encodeURIComponent(versionId)}.json`);
  }

  async versionLog(ada: string): Promise<VersionLogEntry[]> {
    const data = await this.api<{ versions: VersionLogEntry[] }>(
      `/decisions/${encodeURIComponent(ada)}/versionlog.json`,
    );
    return data.versions;
  }

  async downloadDocument(ada: string): Promise<{ buffer: ArrayBuffer; checksum: string | null }> {
    const decision = await this.decision(ada);
    const response = await this._fetch(decision.documentUrl, {
      signal: AbortSignal.timeout(this.timeout),
    });
    if (!response.ok) {
      throw new DiavgeiaError(response.status, response.statusText, decision.documentUrl);
    }
    return { buffer: await response.arrayBuffer(), checksum: decision.documentChecksum };
  }

  // --- Search ---

  async search(params: SearchParams): Promise<SearchResponse> {
    const queryParams: Record<string, string | number | undefined> = {
      org: params.org,
      unit: params.unit,
      from_issue_date: params.from_issue_date,
      to_issue_date: params.to_issue_date,
      from_date: params.from_date,
      to_date: params.to_date,
      status: params.status,
      type: params.type,
      q: params.q,
      subject: params.subject,
      ada: params.ada,
      protocol: params.protocol,
      signer: params.signer,
      tag: params.tag,
      sort: params.sort,
      page: params.page,
      size: params.size,
    };

    return this.searchApi<SearchResponse>('/search.json', queryParams);
  }

  async searchAdvanced(params: { q: string; page?: number; size?: number }): Promise<SearchResponse> {
    return this.searchApi<SearchResponse>('/search/advanced.json', {
      q: params.q,
      page: params.page,
      size: params.size,
    });
  }

  searchAll(params: Omit<SearchParams, 'page'>): AsyncIterable<Decision> {
    const size = params.size ?? 500;
    return paginate(
      (page) => this.search({ ...params, page, size }),
      size,
    );
  }

  async searchTerms(): Promise<Term[]> {
    const data = await this.searchApi<{ terms: Term[] }>('/search/terms.json');
    return data.terms;
  }

  async searchTermsCommon(): Promise<Term[]> {
    const data = await this.searchApi<{ terms: Term[] }>('/search/terms/common.json');
    return data.terms;
  }

  // --- Reference data ---

  async decisionTypes(): Promise<DecisionType[]> {
    const data = await this.api<{ decisionTypes: DecisionType[] }>('/types.json');
    return data.decisionTypes;
  }

  async decisionTypeDetails(typeId: string): Promise<DecisionTypeDetails> {
    return this.api<DecisionTypeDetails>(`/types/${encodeURIComponent(typeId)}/details.json`);
  }

  async dictionaries(): Promise<Dictionary[]> {
    const data = await this.api<{ dictionaries: Dictionary[] }>('/dictionaries.json');
    return data.dictionaries;
  }

  async dictionary(name: string): Promise<DictionaryItem[]> {
    const data = await this.api<{ items: DictionaryItem[] }>(
      `/dictionaries/${encodeURIComponent(name)}.json`,
    );
    return data.items;
  }

  async positions(): Promise<Position[]> {
    const data = await this.api<{ positions: Position[] }>('/positions.json');
    return data.positions;
  }
}
