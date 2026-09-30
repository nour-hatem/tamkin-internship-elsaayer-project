import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { QueueService } from 'src/queue/queue.service';
import { EVENTS } from 'src/common/events';

const mockQueueService = {
  getAllTickets: jest.fn(),
};

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: QueueService, useValue: mockQueueService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  // ─── gate lifecycle ────────────────────────────────────────────────────────

  it('should start with no connected gates', () => {
    expect(service.getConnectedGates()).toEqual([]);
  });

  it('should register a gate on GATE_CONNECTED', () => {
    const ts = new Date('2026-01-01T00:00:00.000Z');
    service.handleGateConnected({ gateId: 'gate-1', socketId: 'sock-a', timestamp: ts });

    const gates = service.getConnectedGates();
    expect(gates).toHaveLength(1);
    expect(gates[0]).toMatchObject({
      gateId: 'gate-1',
      socketId: 'sock-a',
      connectedAt: ts,
    });
  });

  it('should remove a gate on GATE_DISCONNECTED', () => {
    const ts = new Date();
    service.handleGateConnected({ gateId: 'gate-1', socketId: 'sock-a', timestamp: ts });
    service.handleGateDisconnected({ gateId: 'gate-1', socketId: 'sock-a', timestamp: ts });

    expect(service.getConnectedGates()).toEqual([]);
  });

  it('should handle multiple gates and partial disconnects', () => {
    const ts = new Date();
    service.handleGateConnected({ gateId: 'gate-1', socketId: 'sock-a', timestamp: ts });
    service.handleGateConnected({ gateId: 'gate-2', socketId: 'sock-b', timestamp: ts });
    service.handleGateDisconnected({ gateId: 'gate-1', socketId: 'sock-a', timestamp: ts });

    const gates = service.getConnectedGates();
    expect(gates).toHaveLength(1);
    expect(gates[0].gateId).toBe('gate-2');
  });

  it('should overwrite gate entry when same gateId reconnects', () => {
    const ts1 = new Date('2026-01-01T00:00:00.000Z');
    const ts2 = new Date('2026-01-01T01:00:00.000Z');
    service.handleGateConnected({ gateId: 'gate-1', socketId: 'old-sock', timestamp: ts1 });
    service.handleGateConnected({ gateId: 'gate-1', socketId: 'new-sock', timestamp: ts2 });

    const gates = service.getConnectedGates();
    expect(gates).toHaveLength(1);
    expect(gates[0].socketId).toBe('new-sock');
    expect(gates[0].connectedAt).toEqual(ts2);
  });

  // ─── queue delegation ──────────────────────────────────────────────────────

  it('getGateQueue should return only tickets matching the gateId', async () => {
    mockQueueService.getAllTickets.mockResolvedValue([
      { ticketId: 't1', gateId: 'gate-1', plate: 'ABC' },
      { ticketId: 't2', gateId: 'gate-2', plate: 'DEF' },
      { ticketId: 't3', gateId: 'gate-1', plate: 'GHI' },
    ]);

    const result = await service.getGateQueue('gate-1');
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.ticketId)).toEqual(['t1', 't3']);
  });

  it('getGateQueue should return empty array when gateId has no tickets', async () => {
    mockQueueService.getAllTickets.mockResolvedValue([
      { ticketId: 't1', gateId: 'gate-2', plate: 'ABC' },
    ]);

    const result = await service.getGateQueue('gate-999');
    expect(result).toEqual([]);
  });

  it('getFullQueue should delegate to QueueService.getAllTickets', async () => {
    const mockTickets = [
      { ticketId: 't1', gateId: 'gate-1' },
      { ticketId: 't2', gateId: 'gate-2' },
    ];
    mockQueueService.getAllTickets.mockResolvedValue(mockTickets);

    const result = await service.getFullQueue();
    expect(result).toBe(mockTickets);
    expect(mockQueueService.getAllTickets).toHaveBeenCalledTimes(1);
  });
});
