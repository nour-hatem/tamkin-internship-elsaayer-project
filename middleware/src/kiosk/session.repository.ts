import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis/redis.service';
import { KioskSession } from './interfaces/kiosk-session.interface';

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
}
