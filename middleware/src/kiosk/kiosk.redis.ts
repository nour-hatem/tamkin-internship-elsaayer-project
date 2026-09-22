import { RedisService } from '@common/redis/redis.service';
import { Injectable } from '@nestjs/common';

// ------------------------------------------------------------
// Supported kiosk languages.
//
// Matches whatever the rest of the kiosk flow uses to decide
// which message text to generate ('ar' | 'en').
// ------------------------------------------------------------

export type KioskLanguage = 'ar' | 'en';

// ------------------------------------------------------------
// Unique name for each static (non-interpolated) kiosk prompt.
//
// These are the messages that are the same every time regardless
// of session data (unlike the greeting, which embeds the
// customer's name/phone and therefore can't be cached as a
// fixed audio clip). The '-ar' / '-en' suffix is appended
// automatically in buildKey(), so these values should NOT
// include the language themselves.
// ------------------------------------------------------------

export enum KioskMessageKey {
  NAME_ASKING = 'name-asking',
  PHONE_ASKING = 'phone-asking',
  CONFIRMATION_BUTTONS = 'confirmation-buttons',
  PHONE_KEYBOARD = 'phone-keyboard',
  CONTACT_METHOD_ASKING = 'contact-method-asking',
  CONTACT_METHOD_BUTTONS = 'contact-method-buttons',
}

const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

const REDIS_KEY_PREFIX = 'kiosk:tts';

@Injectable()
export class KioskRedisService {
  constructor(private readonly redisService: RedisService) {}

  // ------------------------------------------------------------
  // Builds the unique Redis key for a message + language, e.g.
  // "kiosk:tts:name-asking-ar" or "kiosk:tts:phone-asking-en".
  // ------------------------------------------------------------

  private buildKey(
    messageKey: KioskMessageKey,
    lang: string,
  ): string {
    const suffix = lang === 'ar' ? 'ar' : 'en';

    return `${REDIS_KEY_PREFIX}:${messageKey}-${suffix}`;
  }

  // ------------------------------------------------------------
  // Returns the cached TTS audio buffer for this message, or
  // null if it isn't cached (or has expired).
  //
  // Uses getBuffer rather than get, since TTS audio is binary
  // and a plain get() would corrupt it via string decoding.
  // ------------------------------------------------------------

  async getCachedAudio(
    messageKey: KioskMessageKey,
    lang: string,
  ): Promise<Buffer | null> {
    const key = this.buildKey(messageKey, lang);

    const buffer = await this.redisService
      .getClient()
      .getBuffer(key);

    return buffer ?? null;
  }

  // ------------------------------------------------------------
  // Stores the TTS audio buffer for this message, with a 7-day
  // expiry. After 7 days of no use, Redis drops it automatically
  // and the next request regenerates + re-caches it.
  // ------------------------------------------------------------

  async setCachedAudio(
    messageKey: KioskMessageKey,
    lang: string,
    audio: Buffer,
  ): Promise<void> {
    const key = this.buildKey(messageKey, lang);

    await this.redisService
      .getClient()
      .set(key, audio, 'EX', SEVEN_DAYS_IN_SECONDS);
  }

  // ------------------------------------------------------------
  // Convenience wrapper for the "check cache, else synthesize
  // and cache" pattern used everywhere a static prompt is sent.
  //
  // Usage:
  //
  //   const audio = await this.kioskRedisService.getOrSynthesize(
  //     KioskMessageKey.NAME_ASKING,
  //     lang,
  //     () => this.ttsAdapter.synthesize(message),
  //   );
  //
  // synthesize() only runs on a cache miss, so the TTS adapter
  // (ElevenLabs, etc.) is called at most once per message per
  // language per 7-day window.
  // ------------------------------------------------------------

  async getOrSynthesize(
    messageKey: KioskMessageKey,
    lang: string,
    synthesize: () => Promise<Buffer>,
  ): Promise<Buffer> {
    const cached = await this.getCachedAudio(messageKey, lang);

    if (cached) {
      return cached;
    }

    const audio = await synthesize();

    await this.setCachedAudio(messageKey, lang, audio);

    return audio;
  }
}
