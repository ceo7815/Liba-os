export class RetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableError";
  }
}

export function retryDelayMs(attempt: number, baseMs = 300): number {
  const step = Math.max(0, attempt);
  return baseMs * 2 ** step;
}

export function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof RetryableError) return true;
  if (!(error instanceof Error)) return false;
  if (error.name === "TimeoutError" || error.name === "AbortError") return true;
  return /fetch failed|failed to fetch|network|econnreset|etimedout|socket|abort|timeout/i.test(
    error.message,
  );
}

/** Attempts a call a few times. Delays only between failures that are safe to repeat. */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options?: {
    attempts?: number;
    baseDelayMs?: number;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<T> {
  const attempts = Math.max(1, options?.attempts ?? 3);
  const sleep = options?.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      last = error;
      if (!isRetryableError(error) || attempt === attempts - 1) throw error;
      await sleep(retryDelayMs(attempt, options?.baseDelayMs ?? 300));
    }
  }
  throw last;
}
