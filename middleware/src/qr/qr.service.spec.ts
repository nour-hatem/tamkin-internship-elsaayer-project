import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QrService } from './qr.service';
import { CheckInService } from '../checkin/checkin.service';
import { QrTicketRepository } from './repositories/qr-ticket.repository';
import { QrTokenService } from './qr-token.service';
import { TypedEventEmitter } from '../common/typed-event-emitter.service';

describe('QrService', () => {
  let service: QrService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QrService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('qr'),
          },
        },
        {
          provide: CheckInService,
          useValue: {
            submit: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: QrTicketRepository,
          useValue: {
            create: jest.fn(),
            consume: jest.fn(),
            get: jest.fn(),
            setCurrentTicket: jest.fn(),
            getCurrentTicket: jest.fn(),
            setPlateHint: jest.fn(),
            getPlateHint: jest.fn(),
            getTtl: jest.fn(),
          },
        },
        {
          provide: QrTokenService,
          useValue: {
            generate: jest.fn().mockReturnValue('test-token'),
          },
        },
        {
          provide: TypedEventEmitter,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<QrService>(QrService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});