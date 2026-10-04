import { Test, TestingModule } from '@nestjs/testing';
import { AdminGateway } from './admin.gateway';
import { EVENTS } from '../common/events';

describe('AdminGateway', () => {
  let gateway: AdminGateway;
  let mockServer: any;

  beforeEach(async () => {
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminGateway],
    }).compile();

    gateway = module.get<AdminGateway>(AdminGateway);
    gateway.server = mockServer as any;
  });

  it('handleJoinGate joins the correct room', () => {
    const mockSocket = {
      id: 'sock-1',
      join: jest.fn(),
    };

    const result = gateway.handleJoinGate(mockSocket as any, { gateId: 'gate-1' });

    expect(mockSocket.join).toHaveBeenCalledWith('gate:gate-1');
    expect(result).toEqual({ event: 'joined', gateId: 'gate-1' });
  });

  it('handleLeaveGate leaves the correct room', () => {
    const mockSocket = {
      id: 'sock-1',
      leave: jest.fn(),
    };

    const result = gateway.handleLeaveGate(mockSocket as any, { gateId: 'gate-1' });

    expect(mockSocket.leave).toHaveBeenCalledWith('gate:gate-1');
    expect(result).toEqual({ event: 'left', gateId: 'gate-1' });
  });

  it('handleQueueTicketAdded broadcasts globally to all admin dashboards', () => {
    const mockTicket = {
      ticketId: 'TICK-1001',
      gateId: 'gate-1',
      queueNumber: 1,
    } as any;

    gateway.handleQueueTicketAdded({ ticket: mockTicket });

    expect(mockServer.emit).toHaveBeenCalledWith('QUEUE_TICKET_ADDED', {
      ticket: mockTicket,
    });

    expect(mockServer.to).not.toHaveBeenCalled();
  });

  it('handleQueueTicketStatusUpdated broadcasts to room gate:{gateId}', () => {
    gateway.handleQueueTicketStatusUpdated({
      ticketId: 'TICK-1001',
      gateId: 'gate-2',
      status: 'CALLED',
    });

    expect(mockServer.to).toHaveBeenCalledWith('gate:gate-2');
    expect(mockServer.emit).toHaveBeenCalledWith('QUEUE_TICKET_STATUS_UPDATED', {
      ticketId: 'TICK-1001',
      status: 'CALLED',
    });
  });
});
