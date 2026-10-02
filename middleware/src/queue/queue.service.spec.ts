import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EVENTS } from '../common/events';

describe('QueueService', () => {
  let service: QueueService;
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  describe('isToyotaCustomer flag on ticket creation', () => {
    it('sets isToyotaCustomer: true when customer was found in SAP (found: true)', async () => {
      const ticket = await service.enqueue(
        'gate-1',
        '123-ABC',
        'Ahmed',
        '01012345678',
        'VOICE',
        'SMS',
        true, // found: true in SAP
      );

      expect(ticket.isToyotaCustomer).toBe(true);
      expect(ticket.IsToyotaCustomer).toBe(true);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        EVENTS.QUEUE_TICKET_ADDED,
        { ticket },
      );
    });

    it('sets isToyotaCustomer: false when customer was not found in SAP (found: false)', async () => {
      const ticket = await service.enqueue(
        'gate-1',
        '456-XYZ',
        'Mohamed',
        '01298765432',
        'VOICE',
        'WHATSAPP',
        false, // found: false in SAP
      );

      expect(ticket.isToyotaCustomer).toBe(false);
      expect(ticket.IsToyotaCustomer).toBe(false);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        EVENTS.QUEUE_TICKET_ADDED,
        { ticket },
      );
    });

    it('defaults isToyotaCustomer to false when not explicitly supplied', async () => {
      const ticket = await service.enqueue(
        'gate-2',
        '789-DEF',
        'Customer',
        '01100000000',
        'QR',
        'SMS',
      );

      expect(ticket.isToyotaCustomer).toBe(false);
      expect(ticket.IsToyotaCustomer).toBe(false);
    });
  });
});
