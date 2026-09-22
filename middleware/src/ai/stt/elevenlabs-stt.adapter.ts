import { Injectable, Logger } from '@nestjs/common';
import { AiConfigService } from '../config/ai-config.service';
import { HttpTimeoutError, fetchWithTimeout, safeBodySnippet } from '../common/http';
import { ISttAdapter } from './stt.port';
import { SttProviderError } from './stt-provider.error';
import { normalizeNumberWords } from '../common/Phone-normalizing';

/**
 * Shape of the fields we consume from ElevenLabs' speech-to-text response.
 */
interface ElevenLabsSttResponse {
  text?: unknown;
}

/**
 * Live speech-to-text via ElevenLabs (scribe_v2 by default).
 *
 * Implements ISttAdapter — the REAL middleware port (see DECISIONS.md DR-003):
 *   transcribe(audioBuffer: Buffer): Promise<string>
 *
 * The port has no language parameter. Language is read from AiConfigService
 * (ELEVENLABS_LANGUAGE env var, defaulting to 'ar').
 *
 * Failure contract:
 *  - 2xx with no speech → returns ''
 *  - Any technical failure → throws SttProviderError
 * Never returns '' to signal a provider failure — the distinction matters to the
 * kiosk state machine (outage ≠ driver spoke unclearly).
 */
@Injectable()
export class ElevenLabsSttAdapter implements ISttAdapter {
  private readonly logger = new Logger(ElevenLabsSttAdapter.name);

  constructor(private readonly config: AiConfigService) {}

  async transcribe(audioBuffer: Buffer): Promise<string> {
    
    const apiKey = this.config.elevenLabsApiKey;
    if (!apiKey) {
      throw new SttProviderError(
        'MISSING_API_KEY',
        'ELEVENLABS_API_KEY is not configured',
      );
    }

    const url = `${this.config.elevenLabsBaseUrl}/v1/speech-to-text`;
    const timeoutMs = this.config.sttTimeoutMs;
    const language = this.config.language;

    const form = new FormData();
    // Node's FormData needs a Blob; a bare Buffer is not a valid form value.
    form.append(
      'file',
      new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' }),
      'audio.webm',
    );
    form.append('model_id', this.config.sttModel);
    if (language) form.append('language_code', language);

    let response: Response;
    try {
      response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          // No Content-Type header: fetch must set the multipart boundary itself.
          headers: { 'xi-api-key': apiKey, Accept: 'application/json' },
          body: form,
        },
        timeoutMs,
      );
    } catch (error) {
      if (error instanceof HttpTimeoutError) {
        this.logger.error(
          `ElevenLabs STT timed out after ${timeoutMs}ms (model=${this.config.sttModel})`,
        );
        throw new SttProviderError(
          'TIMEOUT',
          `ElevenLabs STT timed out after ${timeoutMs}ms`,
          { cause: error },
        );
      }
      this.logger.error(`ElevenLabs STT transport failure: ${errorMessage(error)}`);
      throw new SttProviderError(
        'NETWORK_ERROR',
        `ElevenLabs STT request failed: ${errorMessage(error)}`,
        { cause: error },
      );
    }

    if (!response.ok) {
      const body = await safeBodySnippet(response);
      this.logger.error(`ElevenLabs STT returned HTTP ${response.status}: ${body}`);
      throw new SttProviderError(
        'HTTP_ERROR',
        `ElevenLabs STT returned HTTP ${response.status}: ${body}`,
        { status: response.status },
      );
    }

    let payload: ElevenLabsSttResponse;
    try {
      payload = (await response.json()) as ElevenLabsSttResponse;
    } catch (error) {
      throw new SttProviderError(
        'MALFORMED_RESPONSE',
        'ElevenLabs STT returned a body that is not valid JSON',
        { cause: error },
      );
    }

    if (typeof payload.text !== 'string') {
      throw new SttProviderError(
        'MALFORMED_RESPONSE',
        'ElevenLabs STT response is missing the "text" field',
      );
    }

    const transcript = payload.text.trim();

const normalizedTranscript = normalizeNumberWords(transcript);

this.logger.log(
  `[ElevenLabs STT] Original transcript: "${transcript}"`,
);

this.logger.log(
  `[ElevenLabs STT] Normalized transcript: "${normalizedTranscript}"`,
);

return normalizedTranscript;

  }
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

