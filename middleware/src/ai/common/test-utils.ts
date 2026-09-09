import { ConfigService } from '@nestjs/config';
import { AiConfigService } from '../config/ai-config.service';

/**
 * Build an AiConfigService over a fixed env map.
 *
 * Deliberately not process.env: every suite states the exact configuration it
 * depends on, so tests cannot pass or fail because of a stray shell variable —
 * or accidentally pick up a real API key from the developer's environment.
 */
export function configFor(env: Record<string, string> = {}): AiConfigService {
  const fake = {
    get: <T>(key: string): T | undefined => env[key] as unknown as T,
  } as unknown as ConfigService;
  return new AiConfigService(fake);
}

/** Install a mock `fetch` and hand it back for assertions. */
export function mockFetch(
  impl: (url: string, init: RequestInit) => Promise<Response>,
): jest.Mock {
  const mock = jest.fn(impl as never);
  (globalThis as unknown as { fetch: unknown }).fetch = mock;
  return mock as unknown as jest.Mock;
}

/** Install the network tripwire in a beforeEach — prevents any real HTTP. */
export function installNetworkTripwire(): void {
  const TRIPWIRE = (): never => {
    throw new Error(
      'Network access is disabled in tests. Call mockFetch() before exercising an HTTP path.',
    );
  };
  beforeEach(() => {
    (globalThis as unknown as { fetch: unknown }).fetch = TRIPWIRE;
  });
}

/** A real Response carrying a JSON body. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** A real Response carrying binary audio. */
export function audioResponse(bytes: Buffer, status = 200): Response {
  return new Response(new Uint8Array(bytes), {
    status,
    headers: { 'Content-Type': 'audio/mpeg' },
  });
}

/** A real Response for an error status. */
export function errorResponse(status: number, body = 'upstream failure'): Response {
  return new Response(body, { status });
}

/**
 * A request that never completes on its own and rejects only when the caller's
 * own AbortSignal fires. Tests real timeout behaviour without fake timers.
 */
export function hangUntilAborted(init: RequestInit): Promise<Response> {
  return new Promise<Response>((_resolve, reject) => {
    const signal = init.signal;
    if (!signal) return;
    if (signal.aborted) return reject(abortError());
    signal.addEventListener('abort', () => reject(abortError()));
  });
}

function abortError(): Error {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

/** An OpenAI-dialect chat completion wrapping `content`. */
export function chatCompletion(content: string): Response {
  return jsonResponse({ choices: [{ message: { role: 'assistant', content } }] });
}
