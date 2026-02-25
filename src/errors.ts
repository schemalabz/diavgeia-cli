export class DiavgeiaError extends Error {
  readonly status: number;
  readonly statusText: string;

  constructor(status: number, statusText: string, url: string) {
    super(`Diavgeia API error: ${status} ${statusText} (${url})`);
    this.name = 'DiavgeiaError';
    this.status = status;
    this.statusText = statusText;
  }
}

export class DiavgeiaTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Diavgeia API timeout after ${timeoutMs}ms (${url})`);
    this.name = 'DiavgeiaTimeoutError';
  }
}
