import type { Decision, SearchResponse } from './types.js';

/**
 * Async generator that yields decisions one at a time across all pages.
 *
 * @param fetchPage - Function that fetches a single page by page number
 * @param size - Page size (defaults to 500, the API max)
 */
export async function* paginate(
  fetchPage: (page: number) => Promise<SearchResponse>,
  size = 500,
): AsyncIterable<Decision> {
  let page = 0;

  while (true) {
    const response = await fetchPage(page);
    for (const decision of response.decisions) {
      yield decision;
    }

    const totalPages = Math.ceil(response.info.total / size);
    if (page >= totalPages - 1 || response.decisions.length === 0) {
      break;
    }
    page++;
  }
}
