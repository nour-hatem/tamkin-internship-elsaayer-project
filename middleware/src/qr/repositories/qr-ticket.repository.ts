import { Injectable } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';

export interface QrTicketData {
  gateId: string;
  plate?: string;
  plateLocked: boolean;
  name?: string;
  phone?: string;
  source: 'GENERIC' | 'LPR' | 'SAP';
}

@Injectable()
export class QrTicketRepository {
  private readonly ttlSeconds = 180;

  constructor(private readonly redisService: RedisService) {}

  async create(
    token: string,
    data: QrTicketData,
  ): Promise<void> {
    const key = `checkin:ticket:${token}`;

    await this.redisService
      .getClient()
      .set(
        key,
        JSON.stringify(data),
        'EX',
        this.ttlSeconds,
      );
  }

  async get(
    token: string,
  ): Promise<QrTicketData | null> {
    const key = `checkin:ticket:${token}`;

    const value = await this.redisService
      .getClient()
      .get(key);

    return value ? JSON.parse(value) : null;
  }

  async consume(
    token: string,
  ): Promise<QrTicketData | null> {
    const key = `checkin:ticket:${token}`;

    const script = `
      local value = redis.call('GET', KEYS[1])

      if not value then
        return nil
      end

      redis.call('DEL', KEYS[1])

      return value
    `;

    const value = await this.redisService
      .getClient()
      .eval(script, 1, key);

    return value
      ? JSON.parse(value as string)
      : null;
  }

  async delete(token: string): Promise<void> {
    const key = `checkin:ticket:${token}`;

    await this.redisService
      .getClient()
      .del(key);
  }

  async setCurrentTicket(
    gateId: string,
    token: string,
  ): Promise<void> {
    const key = `checkin:current:${gateId}`;

    await this.redisService
      .getClient()
      .set(
        key,
        token,
        'EX',
        this.ttlSeconds,
      );
  }

  async getCurrentTicket(
    gateId: string,
  ): Promise<string | null> {
    const key = `checkin:current:${gateId}`;

    return this.redisService
      .getClient()
      .get(key);
  }

  async setPlateHint(
    gateId: string,
    plate: string,
  ): Promise<void> {
    const key = `checkin:plate-hint:${gateId}`;

    await this.redisService
      .getClient()
      .set(key, plate);
  }

  async getPlateHint(
    gateId: string,
  ): Promise<string | null> {
    const key = `checkin:plate-hint:${gateId}`;

    return this.redisService
      .getClient()
      .get(key);
  }

  async getTtl(token: string): Promise<number> {
    const key = `checkin:ticket:${token}`;

    return this.redisService
      .getClient()
      .ttl(key);
  }
}