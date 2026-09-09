/**
 * Thrown when the text-to-speech provider itself failed: network error,
 * non-2xx response, empty audio body, or timeout.
 *
 * Migrated from src/ai/tts/tts-provider.error.ts. See DECISIONS.md DR-004.
 * Mirrors SttProviderError so callers handle both provider seams the same way.
 */
export type TtsFailureReason =
  | 'TIMEOUT'
  | 'HTTP_ERROR'
  | 'NETWORK_ERROR'
  | 'EMPTY_AUDIO'
  | 'MISSING_API_KEY';

export class TtsProviderError extends Error {
  readonly reason: TtsFailureReason;
  readonly status?: number;
  readonly provider: string;
  readonly cause?: unknown;

  constructor(
    reason: TtsFailureReason,
    message: string,
    options: { provider?: string; status?: number; cause?: unknown } = {},
  ) {
    super(message);
    this.name = 'TtsProviderError';
    this.reason = reason;
    this.provider = options.provider ?? 'elevenlabs';
    this.status = options.status;
    this.cause = options.cause;
    Object.setPrototypeOf(this, TtsProviderError.prototype);
  }
}
