import { ContactMethod } from '@common/enums/contactMethod.enum';
//import { ContactMethod } from '../ai';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { EVENTS } from '../common/events';
import type { ContactOutcomePayload } from '../common/typed-event-emitter.service';
import { ContactService } from 'src/contact/contact.service';

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
  IsToyotaCustomer?: boolean;
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

  constructor(
    private readonly contactService: ContactService,
    @Optional()
    private readonly eventEmitter?: EventEmitter2,
  ) {}

private async emitStatusUpdated(ticket: QueueTicket) {
  this.eventEmitter?.emit(EVENTS.QUEUE_TICKET_STATUS_UPDATED, {
    ticketId: ticket.ticketId,
    gateId: ticket.gateId,
    status: ticket.status,
  });

  const tickets = await this.getAllTickets();

  const waiting = tickets.filter(
    (ticket) => ticket.status === 'WAITING',
  ).length;

  const called = tickets.filter(
    (ticket) => ticket.status === 'CALLED',
  ).length;

  const inService = tickets.filter(
    (ticket) =>
      ticket.status === 'IN_SERVICE',
  ).length;

  this.eventEmitter?.emit(EVENTS.QUEUE_STATS_UPDATED, {
    waiting,
    called,
    inService,
  });
}

  async enqueue(
    gateId: string,
    plate: string,
    name: string,
    phone: string,
    source: 'QR' | 'VOICE',
    preferredContactMethod:ContactMethod,
    IsToyotaCustomer:boolean
  ): Promise<QueueTicket> {
    this.logger.log(
      `[Queue] Creating queue ticket for plate: ${plate}, name: ${name}, source: ${source}, gateId: ${gateId}`,
      {
        plate,
        name,
        source,
        gateId,
        preferredContactMethod,
        IsToyotaCustomer,
      },
    );

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
      IsToyotaCustomer
    };

    this.tickets.push(ticket);

    this.eventEmitter?.emit(EVENTS.QUEUE_TICKET_ADDED, {
      ticket,
    });

    this.logger.log(
      `[Queue] Queue ticket created: ${ticketId} (#${ticket.queueNumber}) for plate: ${plate}, name: ${name}, source: ${source}`,
      {
        ticketId: ticket.ticketId,
        plate: ticket.plate,
        queueNumber: ticket.queueNumber,
        gateId: ticket.gateId,
        source: ticket.source,
        preferredContactMethod: ticket.preferredContactMethod,
      },
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
    this.emitStatusUpdated(ticket);

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
    this.eventEmitter?.emit(EVENTS.SLOT_STATUS_UPDATED, {
      status: slot.status,
    });

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

    this.logger.log(
      `[Queue] Queue rotation triggered: slotId ${slotId}, candidate count ${candidates.length}, attempts ${rotation.attempts}`,
      {
        slotId,
        gateId,
        candidateCount: candidates.length,
        candidateTicketIds: rotation.candidateTicketIds,
        attempts: rotation.attempts,
      },
    );

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
    this.emitStatusUpdated(ticket);

    rotation.attempts += 1;

    this.logger.log(
      `[Queue] Queue rotation candidate called: slotId ${slotId}, ticketId ${ticket.ticketId}, plate ${ticket.plate}, queueNumber ${ticket.queueNumber}, attempt ${rotation.attempts}/${this.MAX_CONTACT_ATTEMPTS}, method ${ticket.preferredContactMethod}`,
      {
        slotId,
        ticketId: ticket.ticketId,
        plate: ticket.plate,
        queueNumber: ticket.queueNumber,
        attemptCount: rotation.attempts,
        maxAttempts: this.MAX_CONTACT_ATTEMPTS,
        contactMethod: ticket.preferredContactMethod,
      },
    );

     await this.contactService.notify({
    ticketId: ticket.ticketId,
    slotId,
    phone: ticket.phone,
    name: ticket.name,
    preferredContactMethod: ticket.preferredContactMethod,
  });
    this.logger.log(`[QueueService] Contact method: ${ticket.preferredContactMethod}`);



    return ticket;
  }

  /**
   * Handles a successful contact acknowledgement.
   *
   * ContactService emits this event when the customer accepts
   * the slot assignment.
   */
  @OnEvent(EVENTS.CONTACT_ACK)
  async handleContactAck(payload: ContactOutcomePayload): Promise<void> {
    const { ticketId, slotId } = payload;

    const slot = await this.getSlot(slotId);

    if (!slot) {
      this.logger.warn(`[QueueService] CONTACT_ACK ignored. Slot ${slotId} does not exist.`);
      return;
    }

    const rotation = this.rotations.get(slotId);

    if (!rotation) {
      this.logger.warn(
        `[QueueService] CONTACT_ACK ignored. No active rotation for slot ${slotId}.`,
      );
      return;
    }

    const currentTicketId = rotation.candidateTicketIds[rotation.currentIndex];

    if (currentTicketId !== ticketId) {
      this.logger.warn(
        `[QueueService] CONTACT_ACK ignored. Ticket ${ticketId} is not the current candidate for slot ${slotId}. Current ticket: ${currentTicketId}`,
      );
      return;
    }

    const ticket = await this.getTicketById(ticketId);

    if (!ticket) {
      this.logger.warn(`[QueueService] CONTACT_ACK ignored. Ticket ${ticketId} does not exist.`);
      return;
    }

    ticket.status = 'ACKNOWLEDGED';
    this.emitStatusUpdated(ticket);
    slot.status = 'OCCUPIED';
    
    this.eventEmitter?.emit(EVENTS.SLOT_STATUS_UPDATED, {
      status: slot.status,
    });

    this.rotations.delete(slotId);

    this.logger.log(`[QueueService] Queue #${ticket.queueNumber} acknowledged slot ${slotId}`);
  }

  /**
   * Handles a contact timeout.
   *
   * ContactService emits this event when the customer does not
   * respond before the contact timer expires.
   */
  @OnEvent(EVENTS.CONTACT_TIMEOUT)
  async handleContactTimeout(payload: ContactOutcomePayload): Promise<void> {
    const { ticketId, slotId } = payload;

    const slot = await this.getSlot(slotId);

    if (!slot) {
      this.logger.warn(`[QueueService] CONTACT_TIMEOUT ignored. Slot ${slotId} does not exist.`);
      return;
    }

    const rotation = this.rotations.get(slotId);

    if (!rotation) {
      this.logger.warn(
        `[QueueService] CONTACT_TIMEOUT ignored. No active rotation for slot ${slotId}.`,
      );
      return;
    }

    const currentTicketId = rotation.candidateTicketIds[rotation.currentIndex];

    if (currentTicketId !== ticketId) {
      this.logger.warn(
        `[QueueService] CONTACT_TIMEOUT ignored. Ticket ${ticketId} is not the current candidate for slot ${slotId}. Current ticket: ${currentTicketId}`,
      );
      return;
    }

    const currentTicket = await this.getTicketById(ticketId);

    if (!currentTicket) {
      this.logger.warn(
        `[QueueService] CONTACT_TIMEOUT ignored. Ticket ${ticketId} does not exist.`,
      );
      return;
    }

    this.logger.log(
      `[Queue] Queue rotation timeout triggered: slotId ${slotId}, ticketId ${ticketId}, plate ${currentTicket.plate}, queueNumber ${currentTicket.queueNumber}`,
      {
        slotId,
        ticketId,
        plate: currentTicket.plate,
        queueNumber: currentTicket.queueNumber,
        previousAttempts: rotation.attempts,
      },
    );

    currentTicket.status = 'WAITING';
    this.emitStatusUpdated(currentTicket);

    rotation.currentIndex = (rotation.currentIndex + 1) % rotation.candidateTicketIds.length;

    if (rotation.attempts >= this.MAX_CONTACT_ATTEMPTS) {
      rotation.attempts = 0;

      this.logger.log(
        `[QueueService] Maximum contact attempts reached. Starting a new contact cycle for slot ${slotId}`,
      );
    }

    const nextTicket = await this.callNextCandidate(slotId);

    this.logger.log(
      `[Queue] Queue rotation advanced: slotId ${slotId}, timed-out ticket ${currentTicket.ticketId} (plate ${currentTicket.plate}), next candidate ticket ${nextTicket?.ticketId ?? 'none'}`,
      {
        slotId,
        timedOutTicketId: currentTicket.ticketId,
        timedOutPlate: currentTicket.plate,
        nextTicketId: nextTicket?.ticketId ?? null,
      },
    );
  }

  /**
   * Simulation endpoint helper.
   *
   * acknowledged=true simulates CONTACT_ACK.
   * acknowledged=false simulates CONTACT_TIMEOUT.
   */
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

    const previousAttempts = rotation.attempts;

    if (acknowledged) {
      await this.handleContactAck({
        ticketId: currentTicketId,
        slotId,
      });

      return {
        slot,
        ticket: currentTicket,
        acknowledged: true,
        attempts: previousAttempts,
      };
    }

    await this.handleContactTimeout({
      ticketId: currentTicketId,
      slotId,
    });

    const updatedRotation = this.rotations.get(slotId);

    const nextTicketId = updatedRotation
      ? updatedRotation.candidateTicketIds[updatedRotation.currentIndex]
      : undefined;

    const nextTicket = nextTicketId ? await this.getTicketById(nextTicketId) : undefined;

    return {
      slot,
      ticket: currentTicket,
      nextTicket,
      acknowledged: false,
      attempts: updatedRotation?.attempts ?? 0,
    };
  }
}
