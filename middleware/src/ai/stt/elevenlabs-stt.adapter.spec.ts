import { ElevenLabsSttAdapter } from './elevenlabs-stt.adapter';
import { SttProviderError } from './stt-provider.error';
import {
  configFor,
  errorResponse,
  hangUntilAborted,
  installNetworkTripwire,
  jsonResponse,
  mockFetch,
} from '../common/test-utils';

/**
 * ElevenLabsSttAdapter — migrated from src/ai/stt/elevenlabs-stt.adapter.spec.ts.
 *
 * Adapted to the REAL ISttAdapter port (see DECISIONS.md DR-003):
 *   transcribe(audioBuffer: Buffer): Promise<string>   ← returns bare string, no language param
 *
 * The real API is never contacted: each test that exercises HTTP installs its own
 * mockFetch; installNetworkTripwire() throws on any unguarded network call.
 */
describe('ElevenLabsSttAdapter (real ISttAdapter port)', () => {
  installNetworkTripwire();

  const AUDIO = Buffer.from('fake-webm-bytes');
  const BASE_ENV = {
    ELEVENLABS_API_KEY: 'test-key-not-a-real-secret',
    STT_TIMEOUT_MS: '40',
  };

  const build = (env: Record<string, string> = {}) =>
    new ElevenLabsSttAdapter(configFor({ ...BASE_ENV, ...env }));

  describe('successful transcription', () => {
    it('returns the transcript string from the provider response', async () => {
      mockFetch(async () => jsonResponse({ text: 'ايوه' }));

      const result = await build().transcribe(AUDIO);

      expect(result).toBe('ايوه');
    });

    it('returns a bare string, not an object (real port contract)', async () => {
      mockFetch(async () => jsonResponse({ text: 'yes' }));

      const result = await build().transcribe(AUDIO);

      expect(typeof result).toBe('string');
      expect(result).not.toHaveProperty('transcript');
    });

    it('calls the speech-to-text endpoint with scribe_v2 and the API key', async () => {
      const fetchMock = mockFetch(async () => jsonResponse({ text: 'yes' }));

      await build().transcribe(AUDIO);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

      expect(url).toBe('https://api.elevenlabs.io/v1/speech-to-text');
      expect(init.method).toBe('POST');
      expect(init.headers).toMatchObject({ 'xi-api-key': 'test-key-not-a-real-secret' });

      const form = init.body as FormData;
      expect(form).toBeInstanceOf(FormData);
      expect(form.get('model_id')).toBe('scribe_v2');
      expect(form.get('file')).toBeInstanceOf(Blob);
    });

    it('uses the language from config (ELEVENLABS_LANGUAGE, default ar)', async () => {
      const fetchMock = mockFetch(async () => jsonResponse({ text: 'yes' }));

      await build().transcribe(AUDIO);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect((init.body as FormData).get('language_code')).toBe('ar');
    });

    it('honours a configured language override', async () => {
      const fetchMock = mockFetch(async () => jsonResponse({ text: 'yes' }));

      await build({ ELEVENLABS_LANGUAGE: 'en' }).transcribe(AUDIO);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect((init.body as FormData).get('language_code')).toBe('en');
    });

    it('trims the transcript', async () => {
      mockFetch(async () => jsonResponse({ text: '  yes  ' }));

      expect(await build().transcribe(AUDIO)).toBe('yes');
    });

    it('a 2xx with no speech returns an empty string, NOT an error', async () => {
      mockFetch(async () => jsonResponse({ text: '' }));

      await expect(build().transcribe(AUDIO)).resolves.toBe('');
    });

    it('honours an overridden model and base URL', async () => {
      const fetchMock = mockFetch(async () => jsonResponse({ text: 'yes' }));

      await build({
        ELEVENLABS_STT_MODEL: 'scribe_v3',
        ELEVENLABS_BASE_URL: 'https://proxy.internal/',
      }).transcribe(AUDIO);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://proxy.internal/v1/speech-to-text');
      expect((init.body as FormData).get('model_id')).toBe('scribe_v3');
    });

    it('never sets Content-Type itself, so fetch can add the multipart boundary', async () => {
      const fetchMock = mockFetch(async () => jsonResponse({ text: 'yes' }));

      await build().transcribe(AUDIO);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headerNames = Object.keys(init.headers as Record<string, string>).map(
        (h) => h.toLowerCase(),
      );
      expect(headerNames).not.toContain('content-type');
    });
  });

  describe('non-2xx response', () => {
    it.each([400, 401, 422, 429, 500, 503])(
      'throws SttProviderError on HTTP %i',
      async (status) => {
        mockFetch(async () => errorResponse(status, 'provider said no'));

        const error = await build().transcribe(AUDIO).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(SttProviderError);
        expect(error).toMatchObject({ reason: 'HTTP_ERROR', status });
        expect((error as SttProviderError).message).toContain('provider said no');
      },
    );

    it('does not resolve to an empty string on failure', async () => {
      mockFetch(async () => errorResponse(500));

      await expect(build().transcribe(AUDIO)).rejects.toBeInstanceOf(SttProviderError);
    });
  });

  describe('timeout', () => {
    it('aborts and throws a TIMEOUT error rather than hanging', async () => {
      mockFetch((_url, init) => hangUntilAborted(init));

      const error = await build({ STT_TIMEOUT_MS: '30' })
        .transcribe(AUDIO)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(SttProviderError);
      expect(error).toMatchObject({ reason: 'TIMEOUT' });
      expect((error as SttProviderError).message).toContain('30ms');
    });

    it('passes an AbortSignal so the request is genuinely cancellable', async () => {
      const fetchMock = mockFetch((_url, init) => hangUntilAborted(init));

      await build({ STT_TIMEOUT_MS: '25' }).transcribe(AUDIO).catch(() => undefined);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.signal).toBeDefined();
      expect(init.signal?.aborted).toBe(true);
    });
  });

  describe('other technical failures', () => {
    it('maps a transport error to NETWORK_ERROR', async () => {
      mockFetch(async () => { throw new Error('ECONNREFUSED'); });

      const error = await build().transcribe(AUDIO).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(SttProviderError);
      expect(error).toMatchObject({ reason: 'NETWORK_ERROR' });
    });

    it('rejects a 2xx body that is not JSON', async () => {
      mockFetch(async () => new Response('<html>nope</html>', { status: 200 }));

      await expect(build().transcribe(AUDIO)).rejects.toMatchObject({
        reason: 'MALFORMED_RESPONSE',
      });
    });

    it('rejects a 2xx JSON body with no "text" field', async () => {
      mockFetch(async () => jsonResponse({ words: [] }));

      await expect(build().transcribe(AUDIO)).rejects.toMatchObject({
        reason: 'MALFORMED_RESPONSE',
      });
    });

    it('fails with MISSING_API_KEY before making any request', async () => {
      const fetchMock = mockFetch(async () => jsonResponse({ text: 'yes' }));
      const adapter = new ElevenLabsSttAdapter(configFor({ STT_TIMEOUT_MS: '40' }));

      await expect(adapter.transcribe(AUDIO)).rejects.toMatchObject({
        reason: 'MISSING_API_KEY',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('error typing', () => {
    it('is catchable via instanceof and names its provider', async () => {
      mockFetch(async () => errorResponse(503));

      try {
        await build().transcribe(AUDIO);
        throw new Error('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SttProviderError);
        expect(error).toBeInstanceOf(Error);
        expect((error as SttProviderError).name).toBe('SttProviderError');
        expect((error as SttProviderError).provider).toBe('elevenlabs');
      }
    });
  });
});
