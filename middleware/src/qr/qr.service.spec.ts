import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QrService } from './qr.service';
import { CheckInService } from '../checkin/checkin.service';

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
      ],
    }).compile();

    service = module.get<QrService>(QrService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
