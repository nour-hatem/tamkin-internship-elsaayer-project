import { Injectable, Logger } from '@nestjs/common';
import { ContactMethod } from '../ai';

export type QueueTicketStatus =
  'WAITING' | 'CALLED' | 'ACKNOWLEDGED' | 'IN_SERVICE' | 'COMPLETED' | 'SKIPPED';

export type QueueSlotStatus = 'AVAILABLE' | 'OCCUPIED';

export interface QueueTicket {
  ticketId: string;
  queueNumber: number;
  gateId: string;
  plate: string;
  name: string;
  phone: string;
  source: 'QR' | 'VOICE';
  preferredContactMethod: ContactMethod;
  status: QueueTicketStatus;
  createdAt: Date;
}

export interface QueueSlot {
  slotId: string;
  gateId: string;
  status: QueueSlotStatus;
}

export interface SlotRotationState {
  slotId: string;
  candidateTicketIds: string[];
  currentIndex: number;
  attempts: number;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  private readonly MAX_CONTACT_ATTEMPTS = 3;

  private tickets: QueueTicket[] = [];
  private slots: QueueSlot[] = [];
  private rotations = new Map<string, SlotRotationState>();
  private ticketCounter = 1000;
  private queueNumberCounter = 0;

  async enqueue(
    gateId: string,
    plate: string,
    name: string,
    phone: string,
    source: 'QR' | 'VOICE',
    preferredContactMethod: ContactMethod,
  ): Promise<QueueTicket> {
    this.ticketCounter += 1;
    this.queueNumberCounter += 1;

    const ticketId = `TICK-${this.ticketCounter}`;

    const ticket: QueueTicket = {
      ticketId,
      queueNumber: this.queueNumberCounter,
      gateId,
      plate,
      name,
      phone,
      source,
      preferredContactMethod,
      status: 'WAITING',
      createdAt: new Date(),
    };

    this.tickets.push(ticket);

    this.logger.log(
      `[QueueService] Queue #${ticket.queueNumber} created: ${ticketId} for ${name} (${plate}) via ${source}`,
    );

    return ticket;
  }

  async getActiveTicketForPlate(plate: string): Promise<QueueTicket | undefined> {
    return this.tickets.find(
      (ticket) =>
        ticket.plate === plate && ticket.status !== 'COMPLETED' && ticket.status !== 'SKIPPED',
    );
  }

  async getNextWaitingTicket(): Promise<QueueTicket | undefined> {
    return this.tickets.find((ticket) => ticket.status === 'WAITING');
  }

  async getTicketById(ticketId: string): Promise<QueueTicket | undefined> {
    return this.tickets.find((ticket) => ticket.ticketId === ticketId);
  }

  async updateTicketStatus(
    ticketId: string,
    status: QueueTicketStatus,
  ): Promise<QueueTicket | undefined> {
    const ticket = await this.getTicketById(ticketId);

    if (!ticket) {
      return undefined;
    }

    ticket.status = status;

    this.logger.log(
      `[QueueService] Ticket ${ticket.ticketId} (#${ticket.queueNumber}) status changed to ${status}`,
    );

    return ticket;
  }

  async getWaitingTickets(): Promise<QueueTicket[]> {
    return this.tickets.filter((ticket) => ticket.status === 'WAITING');
  }

  async getAllTickets(): Promise<QueueTicket[]> {
    return this.tickets;
  }

  async createSlot(slotId: string, gateId: string): Promise<QueueSlot> {
    const existingSlot = this.slots.find((slot) => slot.slotId === slotId);

    if (existingSlot) {
      return existingSlot;
    }

    const slot: QueueSlot = {
      slotId,
      gateId,
      status: 'AVAILABLE',
    };

    this.slots.push(slot);

    this.logger.log(`[QueueService] Slot ${slotId} created for ${gateId}`);

    return slot;
  }

  async getSlot(slotId: string): Promise<QueueSlot | undefined> {
    return this.slots.find((slot) => slot.slotId === slotId);
  }

  async getAllSlots(): Promise<QueueSlot[]> {
    return this.slots;
  }

  async simulateSlotAvailable(
    slotId: string,
    gateId: string,
  ): Promise<{
    slot: QueueSlot;
    selectedTicket?: QueueTicket;
    rotation: SlotRotationState;
  }> {
    let slot = await this.getSlot(slotId);

    if (!slot) {
      slot = await this.createSlot(slotId, gateId);
    }

    if (slot.status === 'OCCUPIED') {
      throw new Error(`Slot ${slotId} is currently occupied`);
    }

    slot.status = 'AVAILABLE';

    const waitingTickets = await this.getWaitingTickets();

    if (waitingTickets.length === 0) {
      this.logger.log(`[QueueService] Slot ${slotId} is available but queue is empty`);

      return {
        slot,
        rotation: {
          slotId,
          candidateTicketIds: [],
          currentIndex: 0,
          attempts: 0,
        },
      };
    }

    const candidates = waitingTickets.slice(0, this.MAX_CONTACT_ATTEMPTS);

    const rotation: SlotRotationState = {
      slotId,
      candidateTicketIds: candidates.map((ticket) => ticket.ticketId),
      currentIndex: 0,
      attempts: 0,
    };

    this.rotations.set(slotId, rotation);

    const selectedTicket = await this.callNextCandidate(slotId);

    return {
      slot,
      selectedTicket,
      rotation,
    };
  }

  private async callNextCandidate(slotId: string): Promise<QueueTicket | undefined> {
    const rotation = this.rotations.get(slotId);

    if (!rotation || rotation.candidateTicketIds.length === 0) {
      return undefined;
    }

    const ticketId = rotation.candidateTicketIds[rotation.currentIndex];

    const ticket = await this.getTicketById(ticketId);

    if (!ticket) {
      return undefined;
    }

    ticket.status = 'CALLED';

    rotation.attempts += 1;

    this.logger.log(
      `[QueueService] Contact attempt ${rotation.attempts}/${this.MAX_CONTACT_ATTEMPTS} for Queue #${ticket.queueNumber}`,
    );

    this.logger.log(`[QueueService] Contact method: ${ticket.preferredContactMethod}`);

    return ticket;
  }

  async simulateAck(
    slotId: string,
    acknowledged: boolean,
  ): Promise<{
    slot: QueueSlot;
    ticket?: QueueTicket;
    nextTicket?: QueueTicket;
    acknowledged: boolean;
    attempts: number;
  }> {
    const slot = await this.getSlot(slotId);

    if (!slot) {
      throw new Error(`Slot ${slotId} does not exist`);
    }

    const rotation = this.rotations.get(slotId);

    if (!rotation) {
      throw new Error(`No active queue rotation for slot ${slotId}`);
    }

    const currentTicketId = rotation.candidateTicketIds[rotation.currentIndex];

    const currentTicket = await this.getTicketById(currentTicketId);

    if (!currentTicket) {
      throw new Error(`Current queue ticket ${currentTicketId} does not exist`);
    }

    if (acknowledged) {
      currentTicket.status = 'ACKNOWLEDGED';

      slot.status = 'OCCUPIED';

      this.rotations.delete(slotId);

      this.logger.log(
        `[QueueService] Queue #${currentTicket.queueNumber} acknowledged slot ${slotId}`,
      );

      return {
        slot,
        ticket: currentTicket,
        acknowledged: true,
        attempts: rotation.attempts,
      };
    }

    currentTicket.status = 'WAITING';

    rotation.currentIndex = (rotation.currentIndex + 1) % rotation.candidateTicketIds.length;

    if (rotation.attempts >= this.MAX_CONTACT_ATTEMPTS) {
      rotation.attempts = 0;

      this.logger.log(
        `[QueueService] Maximum contact attempts reached. Starting a new contact cycle for slot ${slotId}`,
      );
    }

    const nextTicket = await this.callNextCandidate(slotId);

    this.logger.log(
      `[QueueService] Queue #${currentTicket.queueNumber} did not acknowledge. Rotating to Queue #${nextTicket?.queueNumber ?? 'none'}`,
    );

    return {
      slot,
      ticket: currentTicket,
      nextTicket,
      acknowledged: false,
      attempts: rotation.attempts,
    };
  }
}
