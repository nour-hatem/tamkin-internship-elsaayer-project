import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis/redis.service';
import { KioskSession } from './interfaces/kiosk-session.interface';

export type AtomicTransitionStatus = 'SUCCESS' | 'STATE_MISMATCH' | 'SESSION_NOT_FOUND';

export interface AtomicTransitionResult {
  status: AtomicTransitionStatus;
  session: KioskSession | null;
  currentState?: string;
}

const LUA_TRANSITION_STATE = `
local sessionKey = KEYS[1]
local expectedState = ARGV[1]
local newState = ARGV[2]

local raw = redis.call('GET', sessionKey)
if not raw then
  return {'SESSION_NOT_FOUND'}
end

local session = cjson.decode(raw)
if session['currentState'] ~= expectedState then
  return {'STATE_MISMATCH', session['currentState'] or ''}
end

session['currentState'] = newState
local updated = cjson.encode(session)

local ttl = redis.call('PTTL', sessionKey)
if ttl > 0 then
  redis.call('SET', sessionKey, updated, 'PX', ttl)
else
  redis.call('SET', sessionKey, updated)
end

return {'SUCCESS', updated}
`;

@Injectable()
export class SessionRepository {
  private readonly logger = new Logger(SessionRepository.name);
  private readonly PREFIX = 'kiosk:session:';
  private readonly GATE_PREFIX = 'kiosk:gate:';

  constructor(private readonly redisService: RedisService) {}

  private getSessionKey(sessionId: string): string {
    return `${this.PREFIX}${sessionId}`;
  }

  private getGateKey(gateId: string): string {
    return `${this.GATE_PREFIX}${gateId}:session`;
  }

  async save(session: KioskSession, ttlSeconds?: number): Promise<void> {
    const client = this.redisService.getClient();
    const sessionKey = this.getSessionKey(session.sessionId);
    const gateKey = this.getGateKey(session.gateId);
    const data = JSON.stringify(session);

    if (ttlSeconds && ttlSeconds > 0) {
      await client.set(sessionKey, data, 'EX', ttlSeconds);
      await client.set(gateKey, session.sessionId, 'EX', ttlSeconds);
    } else {
      await client.set(sessionKey, data);
      await client.set(gateKey, session.sessionId);
    }

    this.logger.log(`Saved session ${session.sessionId} for gate ${session.gateId} in Redis`);
  }

  async findById(sessionId: string): Promise<KioskSession | null> {
    const client = this.redisService.getClient();
    const sessionKey = this.getSessionKey(sessionId);
    const raw = await client.get(sessionKey);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as KioskSession;
    } catch (err) {
      this.logger.error(`Failed to parse session JSON for sessionId ${sessionId}`, err);
      return null;
    }
  }

  async findByGateId(gateId: string): Promise<KioskSession | null> {
    const client = this.redisService.getClient();
    const gateKey = this.getGateKey(gateId);
    const sessionId = await client.get(gateKey);
    if (!sessionId) return null;

    return this.findById(sessionId);
  }

  async delete(sessionId: string, gateId?: string): Promise<void> {
    const client = this.redisService.getClient();
    const sessionKey = this.getSessionKey(sessionId);

    if (gateId) {
      const gateKey = this.getGateKey(gateId);
      await client.del(sessionKey, gateKey);
    } else {
      const existing = await this.findById(sessionId);
      if (existing) {
        const gateKey = this.getGateKey(existing.gateId);
        await client.del(sessionKey, gateKey);
      } else {
        await client.del(sessionKey);
      }
    }

    this.logger.log(`Deleted session ${sessionId} from Redis`);
  }

  async atomicTransitionState(
    sessionId: string,
    expectedState: string,
    newState: string,
  ): Promise<AtomicTransitionResult> {
    const client = this.redisService.getClient();
    const sessionKey = this.getSessionKey(sessionId);

    const result = (await client.eval(
      LUA_TRANSITION_STATE,
      1,
      sessionKey,
      expectedState,
      newState,
    )) as [string, string?];

    const [status, payload] = result;

    if (status === 'SUCCESS' && payload) {
      const session = JSON.parse(payload) as KioskSession;
      this.logger.log(
        `Transitioned session ${sessionId} state from ${expectedState} to ${newState}`,
      );
      return { status: 'SUCCESS', session };
    }

    if (status === 'STATE_MISMATCH') {
      const actualState = payload || '';
      this.logger.warn(
        `State mismatch for session ${sessionId}: expected ${expectedState}, found ${actualState}`,
      );
      return { status: 'STATE_MISMATCH', currentState: actualState, session: null };
    }

    this.logger.warn(`Session ${sessionId} not found for state transition`);
    return { status: 'SESSION_NOT_FOUND', session: null };
  }
}
