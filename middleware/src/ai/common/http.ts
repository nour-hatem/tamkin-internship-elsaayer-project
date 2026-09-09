/**
 * Shared timeout-bounded fetch used by every outbound call in the AI layer.
 *
 * Migrated from src/ai/common/http.ts. See DECISIONS.md DR-008.
 * Uses Node 18+ global fetch — no axios dependency needed.
 */

/** Raised when a request exceeded its budget. Adapters translate this into
 *  their own typed provider error with `reason: 'TIMEOUT'`. */
export class HttpTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Request aborted after ${timeoutMs}ms`);
    this.name = 'HttpTimeoutError';
    this.timeoutMs = timeoutMs;
    Object.setPrototypeOf(this, HttpTimeoutError.prototype);
  }
}

function isAbort(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

/**
 * Perform a request, aborting it after `timeoutMs`.
 *
 * @throws {HttpTimeoutError} the budget elapsed first
 * @throws {Error}            any genuine transport failure, unchanged
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  (timer as unknown as { unref?: () => void }).unref?.();

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (isAbort(error) || controller.signal.aborted) {
      throw new HttpTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Best-effort body snippet for logs/errors. Never throws, always bounded. */
export async function safeBodySnippet(response: Response, max = 300): Promise<string> {
  try {
    const text = await response.text();
    return text.length > max ? `${text.slice(0, max)}…` : text;
  } catch {
    return '<unreadable body>';
  }
}
