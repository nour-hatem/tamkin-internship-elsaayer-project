import { Injectable, Logger } from '@nestjs/common';
import { AiConfigService } from '../config/ai-config.service';
import { HttpTimeoutError, fetchWithTimeout, safeBodySnippet } from '../common/http';
import { ITtsAdapter } from './tts.port';
import { TtsProviderError } from './tts-provider.error';

/**
 * Live text-to-speech via ElevenLabs (eleven_v3 by default), returning raw
 * MP3 bytes for the kiosk avatar to play and lip-sync against.
 *
 * Implements ITtsAdapter — the REAL middleware port (see DECISIONS.md DR-004):
 *   synthesize(text: string): Promise<Buffer>
 *
 * The port has no language parameter. Language is read from AiConfigService
 * (ELEVENLABS_LANGUAGE env var, defaulting to 'ar').
 *
 * NO CACHING HERE, ON PURPOSE. See DECISIONS.md MB-004. A cache belongs in
 * front of this adapter as a decorating ITtsAdapter, not inside it.
 */
@Injectable()
export class ElevenLabsTtsAdapter implements ITtsAdapter {
  private readonly logger = new Logger(ElevenLabsTtsAdapter.name);

  constructor(private readonly config: AiConfigService) {}

  async synthesize(text: string): Promise<Buffer> {
    const apiKey = this.config.elevenLabsApiKey;
    if (!apiKey) {
      throw new TtsProviderError(
        'MISSING_API_KEY',
        'ELEVENLABS_API_KEY is not configured',
      );
    }

    const voiceId = this.config.ttsVoiceId;
    const lang = this.config.language;
    const outputFormat = this.config.ttsOutputFormat;
    const url =
      `${this.config.elevenLabsBaseUrl}/v1/text-to-speech/${encodeURIComponent(voiceId)}` +
      `?output_format=${encodeURIComponent(outputFormat)}`;
    const timeoutMs = this.config.ttsTimeoutMs;

    let response: Response;
    try {
      response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text,
            model_id: this.config.ttsModel,
            // ElevenLabs infers language from text for multilingual models;
            // passing it explicitly keeps Arabic prompts from being read as
            // transliterated English.
            language_code: lang || undefined,
          }),
        },
        timeoutMs,
      );
    } catch (error) {
      if (error instanceof HttpTimeoutError) {
        this.logger.error(
          `ElevenLabs TTS timed out after ${timeoutMs}ms (model=${this.config.ttsModel})`,
        );
        throw new TtsProviderError(
          'TIMEOUT',
          `ElevenLabs TTS timed out after ${timeoutMs}ms`,
          { cause: error },
        );
      }
      this.logger.error(`ElevenLabs TTS transport failure: ${errorMessage(error)}`);
      throw new TtsProviderError(
        'NETWORK_ERROR',
        `ElevenLabs TTS request failed: ${errorMessage(error)}`,
        { cause: error },
      );
    }

    if (!response.ok) {
      const body = await safeBodySnippet(response);
      this.logger.error(`ElevenLabs TTS returned HTTP ${response.status}: ${body}`);
      throw new TtsProviderError(
        'HTTP_ERROR',
        `ElevenLabs TTS returned HTTP ${response.status}: ${body}`,
        { status: response.status },
      );
    }

    const audio = Buffer.from(await response.arrayBuffer());
    if (audio.length === 0) {
      // A 2xx with no audio is a provider fault — the caller asked for speech.
      throw new TtsProviderError(
        'EMPTY_AUDIO',
        'ElevenLabs TTS returned a 2xx response with an empty audio body',
        { status: response.status },
      );
    }

    return audio;
  }
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
