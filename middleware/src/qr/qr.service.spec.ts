import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QrService } from './qr.service';
import { CheckInService } from '../checkin/checkin.service';
import { RedisService } from '../common/redis/redis.service';
import { QrTicketRepository } from './repositories/qr-ticket.repository';
import { QrTokenService } from './qr-token.service';

describe('QrService', () => {
  let service: QrService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QrService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('qr') },
        },
        {
          provide: CheckInService,
          useValue: { submit: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: RedisService,
          useValue: { get: jest.fn(), set: jest.fn() },
        },
        {
          provide: QrTicketRepository,
          useValue: { create: jest.fn(), consume: jest.fn() },
        },
        {
          provide: QrTokenService,
          useValue: { generate: jest.fn().mockReturnValue('test-token') },
        },
      ],
    }).compile();

    service = module.get<QrService>(QrService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
