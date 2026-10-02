import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  correlationId?: string;
  [key: string]: any;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function getCorrelationId(): string | undefined {
  return requestContextStorage.getStore()?.correlationId;
}

export function runWithCorrelationId<T>(correlationId: string, callback: () => T): T {
  const existing = requestContextStorage.getStore() || {};
  return requestContextStorage.run({ ...existing, correlationId }, callback);
}
