import { LlmNluAdapter, parseClassifyResult } from './llm-nlu.adapter';
import { NluRulesAdapter } from '../nlu/nlu-rules.adapter';
import {
  chatCompletion,
  configFor,
  errorResponse,
  hangUntilAborted,
  installNetworkTripwire,
  mockFetch,
} from '../common/test-utils';

describe('LlmNluAdapter (real INluAdapter port)', () => {
  installNetworkTripwire();

  const LLM_ENV = {
    NLU_ADAPTER: 'llm',
    OPENROUTER_API_KEY: 'or-test-key',
    GROQ_API_KEY: 'groq-test-key',
    LLM_TIMEOUT_MS: '40',
  };

  const build = (env: Record<string, string> = {}) =>
    new LlmNluAdapter(new NluRulesAdapter(), configFor({ ...LLM_ENV, ...env }));

  const isOpenRouter = (url: string) => url.includes('openrouter.ai');
  const isGroq = (url: string) => url.includes('groq.com');

  describe('a clear transcript never reaches the LLM', () => {
    it.each([
      ['English yes', 'yes', { intent: 'YES', confidence: 0.98, entities: {} }],
      ['Arabic yes', 'ايوه', { intent: 'YES', confidence: 0.98, entities: {} }],
      ['English no', 'no', { intent: 'NO', confidence: 0.98, entities: {} }],
      ['Arabic no', 'لا', { intent: 'NO', confidence: 0.98, entities: {} }],
      ['valid phone', '01012345678', { intent: 'PHONE', confidence: 0.99, entities: { phone: '01012345678' } }],
    ])('%s short-circuits with zero HTTP calls', async (_l, text, expected) => {
      const fetchMock = mockFetch(async () => chatCompletion('{"intent":"UNKNOWN"}'));

      const result = await build().parse(text as string);

      expect(result).toEqual(expected);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('an empty transcript resolves to UNKNOWN with no HTTP call', async () => {
      const fetchMock = mockFetch(async () => chatCompletion('{"intent":"YES"}'));

      await expect(build().parse('')).resolves.toEqual({
        intent: 'UNKNOWN',
        confidence: 0.0,
        entities: {},
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('OpenRouter succeeds', () => {
    it('returns its classification and NEVER calls Groq', async () => {
      const fetchMock = mockFetch(async (url) => {
        if (isGroq(url)) throw new Error('Groq must not be called');
        return chatCompletion('{"intent":"YES"}');
      });

      const result = await build().parse('ok fine go ahead');

      expect(result).toEqual({ intent: 'YES', confidence: 0.98, entities: {} });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const calledUrls = fetchMock.mock.calls.map(([url]) => url as string);
      expect(calledUrls.some(isOpenRouter)).toBe(true);
      expect(calledUrls.some(isGroq)).toBe(false);
    });

    it('sends the configured model and bearer token', async () => {
      const fetchMock = mockFetch(async () => chatCompletion('{"intent":"NO"}'));

      await build().parse('nah I would rather not');

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
      expect(init.headers).toMatchObject({ Authorization: 'Bearer or-test-key' });

      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body.model).toBe('openai/gpt-oss-20b');
    });

    it('parses a PHONE result spoken as words', async () => {
      mockFetch(async () => chatCompletion('{"intent":"PHONE","phone":"01012345678"}'));

      const result = await build().parse('zero one zero one two three four five six seven eight');

      expect(result).toEqual({
        intent: 'PHONE',
        confidence: 0.99,
        entities: { phone: '01012345678' },
      });
    });
  });

  describe('OpenRouter fails, Groq succeeds', () => {
    it('falls through on non-2xx', async () => {
      const fetchMock = mockFetch(async (url) =>
        isOpenRouter(url) ? errorResponse(500) : chatCompletion('{"intent":"NO"}'),
      );

      const result = await build().parse('absolutely not');

      expect(result).toEqual({ intent: 'NO', confidence: 0.98, entities: {} });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(isOpenRouter(fetchMock.mock.calls[0][0] as string)).toBe(true);
      expect(isGroq(fetchMock.mock.calls[1][0] as string)).toBe(true);
    });

    it('falls through on timeout', async () => {
      mockFetch(async (url, init) =>
        isOpenRouter(url) ? hangUntilAborted(init) : chatCompletion('{"intent":"YES"}'),
      );

      const result = await build({ LLM_TIMEOUT_MS: '30' }).parse('that sounds right');

      expect(result).toEqual({ intent: 'YES', confidence: 0.98, entities: {} });
    });
  });

  describe('both providers fail', () => {
    it('resolves to UNKNOWN without throwing', async () => {
      mockFetch(async () => errorResponse(500));

      const res = await build().parse('unintelligible noise');
      expect(res).toEqual({ intent: 'UNKNOWN', confidence: 0.0, entities: {} });
    });
  });

  describe('parseClassifyResult', () => {
    it.each([
      ['bare object', '{"intent":"YES"}', { intent: 'YES' }],
      ['fenced', '```json\n{"intent":"NO"}\n```', { intent: 'NO' }],
      ['embedded in prose', 'Answer: {"intent":"PHONE","phone":"01555666777"} done.', { intent: 'PHONE', phone: '01555666777' }],
    ])('parses %s', (_label, content, expected) => {
      expect(parseClassifyResult(content as string)).toEqual(expected);
    });
  });
});
