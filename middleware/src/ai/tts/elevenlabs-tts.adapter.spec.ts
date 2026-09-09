import { ElevenLabsTtsAdapter } from './elevenlabs-tts.adapter';
import { TtsProviderError } from './tts-provider.error';
import {
  audioResponse,
  configFor,
  errorResponse,
  hangUntilAborted,
  installNetworkTripwire,
  mockFetch,
} from '../common/test-utils';

/**
 * ElevenLabsTtsAdapter — migrated from src/ai/tts/elevenlabs-tts.adapter.spec.ts.
 *
 * Adapted to the REAL ITtsAdapter port (see DECISIONS.md DR-004):
 *   synthesize(text: string): Promise<Buffer>   ← no language param
 *
 * Language is read from config (ELEVENLABS_LANGUAGE, default 'ar').
 */
describe('ElevenLabsTtsAdapter (real ITtsAdapter port)', () => {
  installNetworkTripwire();

  const MP3 = Buffer.from([0xff, 0xfb, 0x90, 0x64, 0x00, 0x01, 0x02]);
  const BASE_ENV = {
    ELEVENLABS_API_KEY: 'test-key-not-a-real-secret',
    TTS_TIMEOUT_MS: '40',
  };

  const build = (env: Record<string, string> = {}) =>
    new ElevenLabsTtsAdapter(configFor({ ...BASE_ENV, ...env }));

  describe('successful synthesis', () => {
    it('returns the raw MP3 bytes unchanged', async () => {
      mockFetch(async () => audioResponse(MP3));

      const audio = await build().synthesize('اهلا بيك');

      expect(Buffer.isBuffer(audio)).toBe(true);
      expect(audio).toHaveLength(MP3.length);
      expect(audio.equals(MP3)).toBe(true);
    });

    it('posts to the text-to-speech endpoint with eleven_v3 and the API key', async () => {
      const fetchMock = mockFetch(async () => audioResponse(MP3));

      await build().synthesize('welcome');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

      expect(url).toContain('https://api.elevenlabs.io/v1/text-to-speech/');
      expect(init.method).toBe('POST');
      expect(init.headers).toMatchObject({
        'xi-api-key': 'test-key-not-a-real-secret',
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      });

      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body).toMatchObject({ text: 'welcome', model_id: 'eleven_v3' });
    });

    it('uses the language from config (default ar)', async () => {
      const fetchMock = mockFetch(async () => audioResponse(MP3));

      await build().synthesize('welcome');

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body.language_code).toBe('ar');
    });

    it('honours an ELEVENLABS_LANGUAGE override', async () => {
      const fetchMock = mockFetch(async () => audioResponse(MP3));

      await build({ ELEVENLABS_LANGUAGE: 'en' }).synthesize('hi');

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toMatchObject({ language_code: 'en' });
    });

    it('requests an mp3 output format', async () => {
      const fetchMock = mockFetch(async () => audioResponse(MP3));

      await build().synthesize('hi');

      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('output_format=mp3');
    });

    it('honours an overridden model and voice', async () => {
      const fetchMock = mockFetch(async () => audioResponse(MP3));

      await build({
        ELEVENLABS_TTS_MODEL: 'eleven_turbo_v2_5',
        ELEVENLABS_VOICE_ID: 'custom-voice-id',
      }).synthesize('hi');

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/v1/text-to-speech/custom-voice-id');
      expect(JSON.parse(init.body as string)).toMatchObject({ model_id: 'eleven_turbo_v2_5' });
    });

    it('adds no caching layer — every call reaches the provider', async () => {
      // Redis caching is deliberately out of scope (see DECISIONS.md MB-004).
      const fetchMock = mockFetch(async () => audioResponse(MP3));
      const adapter = build();

      await adapter.synthesize('same text');
      await adapter.synthesize('same text');

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('provider failure', () => {
    it.each([401, 422, 429, 500, 503])(
      'throws TtsProviderError on HTTP %i',
      async (status) => {
        mockFetch(async () => errorResponse(status, 'quota exceeded'));

        const error = await build().synthesize('hi').catch((e: unknown) => e);

        expect(error).toBeInstanceOf(TtsProviderError);
        expect(error).toMatchObject({ reason: 'HTTP_ERROR', status });
        expect((error as TtsProviderError).message).toContain('quota exceeded');
      },
    );

    it('maps a transport error to NETWORK_ERROR', async () => {
      mockFetch(async () => { throw new Error('ENOTFOUND api.elevenlabs.io'); });

      await expect(build().synthesize('hi')).rejects.toMatchObject({ reason: 'NETWORK_ERROR' });
    });

    it('throws TIMEOUT rather than hanging', async () => {
      mockFetch((_url, init) => hangUntilAborted(init));

      const error = await build({ TTS_TIMEOUT_MS: '30' })
        .synthesize('hi')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(TtsProviderError);
      expect(error).toMatchObject({ reason: 'TIMEOUT' });
    });

    it('treats a 2xx with an empty audio body as EMPTY_AUDIO', async () => {
      mockFetch(async () => audioResponse(Buffer.alloc(0)));

      await expect(build().synthesize('hi')).rejects.toMatchObject({ reason: 'EMPTY_AUDIO' });
    });

    it('fails with MISSING_API_KEY before making any request', async () => {
      const fetchMock = mockFetch(async () => audioResponse(MP3));
      const adapter = new ElevenLabsTtsAdapter(configFor({ TTS_TIMEOUT_MS: '40' }));

      await expect(adapter.synthesize('hi')).rejects.toMatchObject({ reason: 'MISSING_API_KEY' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('never returns an empty buffer to signal a failure', async () => {
      mockFetch(async () => errorResponse(500));

      const outcome = await build()
        .synthesize('hi')
        .then((buf) => ({ resolved: buf }))
        .catch((error: unknown) => ({ error }));

      expect(outcome).not.toHaveProperty('resolved');
      expect((outcome as { error: unknown }).error).toBeInstanceOf(TtsProviderError);
    });
  });
});
