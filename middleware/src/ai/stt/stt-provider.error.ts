/**
 * Thrown when the speech-to-text provider itself failed: network error,
 * non-2xx response, malformed body, or timeout.
 *
 * Migrated from src/ai/stt/stt-provider.error.ts. See DECISIONS.md DR-003.
 *
 * This exists so a caller can tell a technical outage apart from a driver who
 * spoke unclearly. "Unclear" becomes NluResultDto { intent: 'UNKNOWN', confidence: 0 };
 * broken is this error.
 */
export type SttFailureReason =
  | 'TIMEOUT'
  | 'HTTP_ERROR'
  | 'NETWORK_ERROR'
  | 'MALFORMED_RESPONSE'
  | 'MISSING_API_KEY';

export class SttProviderError extends Error {
  readonly reason: SttFailureReason;
  /** HTTP status, when the failure was a non-2xx response. */
  readonly status?: number;
  /** Provider name, for logs. */
  readonly provider: string;
  readonly cause?: unknown;

  constructor(
    reason: SttFailureReason,
    message: string,
    options: { provider?: string; status?: number; cause?: unknown } = {},
  ) {
    super(message);
    this.name = 'SttProviderError';
    this.reason = reason;
    this.provider = options.provider ?? 'elevenlabs';
    this.status = options.status;
    this.cause = options.cause;
    Object.setPrototypeOf(this, SttProviderError.prototype);
  }
}
