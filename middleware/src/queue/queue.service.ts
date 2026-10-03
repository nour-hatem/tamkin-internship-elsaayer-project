import { ContactMethod } from '@common/enums/contactMethod.enum';
//import { ContactMethod } from '../ai';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { EVENTS } from '../common/events';
import type { ContactOutcomePayload } from '../common/typed-event-emitter.service';
import { ContactService } from 'src/contact/contact.service';

export type QueueTicketStatus =
  | 'WAITING'
  | 'CALLED'
  | 'ACKNOWLEDGED'
  | 'IN_SERVICE'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'NO_SHOW';

export type QueueSlotStatus = 'AVAILABLE' | 'OCCUPIED';

export interface QueueTicket {
  ticketId: string;
  queueNumber: number;
  gateId: string;
  plate: string;
  name: string;
  phone: string;
  source: 'QR' | 'VOICE';
  preferredContactMethod?: ContactMethod;
  status: QueueTicketStatus;
  createdAt: Date;
  isToyotaCustomer?: boolean;
  IsToyotaCustomer?: boolean;
}

export interface QueueSlot {
  slotId: string;
  gateId: string;
  status: QueueSlotStatus;
}

export interface SlotRotationState {
  slotId: string;

  // Current 3-customer rotation window
  candidateTicketIds: string[];

  // Current candidate inside the rotation window
  currentIndex: number;

  // Total contact attempts of the current ticket
  attempts: number;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  private readonly MAX_CONTACT_ATTEMPTS = 3;

  private readonly MAX_TICKET_CONTACT_ATTEMPTS = 3;

  private tickets: QueueTicket[] = [];

  private slots: QueueSlot[] = [];

  /**
   * One rotation state per slot.
   */
  private rotations = new Map<string, SlotRotationState>();

  /**
   * Total contact attempts for every ticket.
   *
   * This is independent from the rotation attempts.
   */
  private contactAttempts = new Map<string, number>();

  /**
   * These counters are only fallback values.
   *
   * The actual next numbers are calculated from existing
   * tickets so numbering continues correctly.
   */
  private ticketCounter = 1000;
  private queueNumberCounter = 0;

  constructor(
    private readonly contactService: ContactService,
    @Optional()
    private readonly eventEmitter?: EventEmitter2,
  ) {}

  // ============================================================
  // EVENTS
  // ============================================================

  private emitStatusUpdated(ticket: QueueTicket): void {
    this.eventEmitter?.emit(EVENTS.QUEUE_TICKET_STATUS_UPDATED, {
      ticketId: ticket.ticketId,
      gateId: ticket.gateId,
      status: ticket.status,
    });
  }

  // ============================================================
  // NUMBER GENERATION
  // ============================================================

  /**
   * Get the next Queue Number.
   *
   * IMPORTANT:
   *
   * We do NOT simply do:
   *
   * ++this.queueNumberCounter
   *
   * because the service may be initialized again.
   *
   * Instead, we calculate from the existing tickets.
   *
   * Example:
   *
   * Existing:
   * #1
   * #2
   * #3
   * #4
   * #5
   *
   * New ticket:
   * #6
   *
   * NO_SHOW tickets are included because their queue numbers
   * must remain part of the history.
   */
  private getNextQueueNumber(): number {
    const maxQueueNumber = this.tickets.reduce(
      (max, ticket) => Math.max(max, ticket.queueNumber),
      0,
    );

    const nextQueueNumber = maxQueueNumber + 1;

    this.queueNumberCounter = nextQueueNumber;

    return nextQueueNumber;
  }

  /**
   * Get the next Ticket ID number.
   *
   * Example:
   *
   * TICK-1000
   * TICK-1001
   * TICK-1002
   *
   * New:
   * TICK-1003
   */
  private getNextTicketNumber(): number {
    const maxTicketNumber = this.tickets.reduce((max, ticket) => {
      const match = ticket.ticketId.match(/^TICK-(\d+)$/);

      if (!match) {
        return max;
      }

      return Math.max(max, Number(match[1]));
    }, 999);

    const nextTicketNumber = maxTicketNumber + 1;

    this.ticketCounter = nextTicketNumber;

    return nextTicketNumber;
  }

  // ============================================================
  // QUEUE / TICKETS
  // ============================================================

  async enqueue(
    gateId: string,
    plate: string,
    name: string,
    phone: string,
    source: 'QR' | 'VOICE',
    preferredContactMethod?: ContactMethod,
    isToyotaCustomer?: boolean,
  ): Promise<QueueTicket> {
    /**
     * IMPORTANT:
     *
     * Queue number is generated from the existing tickets.
     *
     * This means:
     *
     * #1
     * #2
     * #3
     * #4
     * #5
     *
     * New ticket = #6
     *
     * Even if #2 or #3 is NO_SHOW, their records
     * remain in this.tickets and their numbers are preserved.
     */
    const queueNumber = this.getNextQueueNumber();

    const ticketNumber = this.getNextTicketNumber();

    const ticket: QueueTicket = {
      ticketId: `TICK-${ticketNumber}`,
      queueNumber,
      gateId,
      plate,
      name,
      phone,
      source,

      preferredContactMethod,

      status: 'WAITING',

      createdAt: new Date(),

      isToyotaCustomer: isToyotaCustomer ?? false,
      IsToyotaCustomer: isToyotaCustomer ?? false,
    };

    /**
     * IMPORTANT:
     *
     * We ALWAYS push the ticket into this.tickets.
     *
     * NO_SHOW tickets are also kept here.
     *
     * We never delete tickets from this array
     * just because they leave the active queue.
     */
    this.tickets.push(ticket);

    this.contactAttempts.set(ticket.ticketId, 0);

    this.logger.log(
      `[Queue] Ticket added: ${ticket.ticketId} | ` +
        `Queue #${ticket.queueNumber} | ` +
        `${ticket.plate} | Gate ${ticket.gateId}`,
    );

    this.eventEmitter?.emit(EVENTS.QUEUE_TICKET_ADDED, {
      ticket,
    });

    return ticket;
  }

  async getActiveTicketForPlate(
    plate: string,
  ): Promise<QueueTicket | undefined> {
    return this.tickets.find(
      (ticket) =>
        ticket.plate === plate &&
        ticket.status !== 'COMPLETED' &&
        ticket.status !== 'SKIPPED' &&
        ticket.status !== 'NO_SHOW',
    );
  }

  async getNextWaitingTicket(): Promise<QueueTicket | undefined> {
    return this.tickets
      .filter((ticket) => ticket.status === 'WAITING')
      .sort((a, b) => a.queueNumber - b.queueNumber)[0];
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

    return ticket;
  }

  /**
   * Return ONLY active waiting customers.
   *
   * NO_SHOW tickets are intentionally excluded.
   *
   * They are still present in this.tickets,
   * but they are not eligible for rotation.
   */
  async getWaitingTickets(): Promise<QueueTicket[]> {
    return this.tickets
      .filter((ticket) => ticket.status === 'WAITING')
      .sort((a, b) => a.queueNumber - b.queueNumber);
  }

  /**
   * Return ALL tickets including:
   *
   * WAITING
   * CALLED
   * ACKNOWLEDGED
   * IN_SERVICE
   * COMPLETED
   * NO_SHOW
   *
   * IMPORTANT:
   * Nothing is removed from history.
   */
  async getAllTickets(): Promise<QueueTicket[]> {
    return [...this.tickets];
  }

  // ============================================================
  // SLOTS
  // ============================================================

  async createSlot(slotId: string, gateId: string): Promise<QueueSlot> {
    const existing = await this.getSlot(slotId);

    if (existing) {
      return existing;
    }

    const slot: QueueSlot = {
      slotId,
      gateId,
      status: 'AVAILABLE',
    };

    this.slots.push(slot);

    return slot;
  }

  async getSlot(slotId: string): Promise<QueueSlot | undefined> {
    return this.slots.find((slot) => slot.slotId === slotId);
  }

  async getAllSlots(): Promise<QueueSlot[]> {
    return [...this.slots];
  }

  // ============================================================
  // SLOT AVAILABLE / START ROTATION
  // ============================================================

  async simulateSlotAvailable(slotId: string, gateId: string) {
    let slot = await this.getSlot(slotId);

    if (!slot) {
      slot = await this.createSlot(slotId, gateId);
    }

    if (slot.status === 'OCCUPIED') {
      throw new Error(`Slot ${slotId} is already occupied.`);
    }
    
     
    slot.status = 'AVAILABLE';
    this.eventEmitter?.emit(EVENTS.SLOT_STATUS_UPDATED, {
      status: slot.status,
    });

    /**
     * Only WAITING tickets participate
     * in the active rotation.
     *
     * NO_SHOW tickets remain in this.tickets
     * but will NOT appear here.
     */
    const waitingTickets = await this.getWaitingTickets();

    if (waitingTickets.length === 0) {
      this.rotations.delete(slotId);

      return {
        slot,
        selectedTicket: undefined,
        rotation: {
          slotId,
          candidateTicketIds: [],
          currentIndex: 0,
          attempts: 0,
        },
      };
    }

    /**
     * Build the first rotation window.
     *
     * Example:
     *
     * A B C D E
     *
     * candidates:
     * A B C
     */
    const candidates = waitingTickets.slice(0, this.MAX_CONTACT_ATTEMPTS);

    const rotation: SlotRotationState = {
      slotId,
      candidateTicketIds: candidates.map((ticket) => ticket.ticketId),
      currentIndex: 0,
      attempts: 0,
    };

    this.rotations.set(slotId, rotation);

    this.logger.log(
      `[Queue] Slot ${slotId} available. ` +
        `Starting rotation: ${rotation.candidateTicketIds.join(', ')}`,
    );

    const selectedTicket = await this.callNextCandidate(slotId);

    return {
      slot,
      selectedTicket,
      rotation,
    };
  }

  // ============================================================
  // CALL NEXT CANDIDATE
  // ============================================================

  private async callNextCandidate(
    slotId: string,
  ): Promise<QueueTicket | undefined> {
    const rotation = this.rotations.get(slotId);

    if (!rotation || rotation.candidateTicketIds.length === 0) {
      return undefined;
    }

    const ticketId = rotation.candidateTicketIds[rotation.currentIndex];

    const ticket = await this.getTicketById(ticketId);

    if (!ticket) {
      return undefined;
    }

    /**
     * Safety check.
     *
     * A ticket may have left the active queue
     * since the rotation was created.
     */
    if (
      ticket.status === 'NO_SHOW' ||
      ticket.status === 'ACKNOWLEDGED' ||
      ticket.status === 'COMPLETED' ||
      ticket.status === 'SKIPPED'
    ) {
      return undefined;
    }

    ticket.status = 'CALLED';

    this.emitStatusUpdated(ticket);

    const currentAttempts =
      (this.contactAttempts.get(ticket.ticketId) ?? 0) + 1;

    this.contactAttempts.set(ticket.ticketId, currentAttempts);

    rotation.attempts = currentAttempts;

    this.logger.log(
      `[Queue] Contacting ${ticket.ticketId} ` +
        `(${ticket.name}) - ` +
        `attempt ${currentAttempts}/${this.MAX_TICKET_CONTACT_ATTEMPTS} ` +
        `inside rotation slot ${slotId}`,
    );

    await this.contactService.notify({
      ticketId: ticket.ticketId,
      slotId,
      phone: ticket.phone,
      name: ticket.name,
      preferredContactMethod: ticket.preferredContactMethod,
    });

    this.logger.log(
      `[QueueService] Contact method: ${ticket.preferredContactMethod}`,
    );

    return ticket;
  }

  // ============================================================
  // REBUILD ROTATION AFTER NO_SHOW
  // ============================================================

  /**
   * Rebuild the current rotation window after
   * a ticket becomes NO_SHOW.
   *
   * IMPORTANT:
   *
   * We DO NOT delete the ticket.
   *
   * Example:
   *
   * Before:
   *
   * A B C D E
   *
   * A -> NO_SHOW
   *
   * Tickets array:
   *
   * A B C D E
   *
   * Active waiting queue:
   *
   * B C D E
   *
   * New rotation:
   *
   * B C D
   */
  private async rebuildRotationAfterRemoval(
    slotId: string,
    removedTicketId: string,
  ): Promise<void> {
    const rotation = this.rotations.get(slotId);

    if (!rotation) {
      return;
    }

    /**
     * Get only WAITING tickets.
     *
     * The NO_SHOW ticket remains in
     * this.tickets but is naturally excluded.
     */
    const waitingTickets = await this.getWaitingTickets();

    const newCandidates = waitingTickets.slice(0, this.MAX_CONTACT_ATTEMPTS);

    rotation.candidateTicketIds = newCandidates.map(
      (ticket) => ticket.ticketId,
    );

    rotation.currentIndex = 0;
    rotation.attempts = 0;

    this.logger.log(
      `[Queue] Rotation rebuilt after removing ${removedTicketId}. ` +
        `Ticket remains in history as NO_SHOW. ` +
        `New candidates: ${
          rotation.candidateTicketIds.length > 0
            ? rotation.candidateTicketIds.join(', ')
            : 'NONE'
        }`,
    );
  }

  // ============================================================
  // CONTACT ACK
  // ============================================================

  @OnEvent(EVENTS.CONTACT_ACK)
  async handleContactAck(payload: ContactOutcomePayload) {
    const slotId = payload.slotId;

    const rotation = this.rotations.get(slotId);

    if (!rotation) {
      this.logger.warn(`[Queue] No active rotation found for slot ${slotId}`);

      return;
    }

    const ticketId = rotation.candidateTicketIds[rotation.currentIndex];

    if (!ticketId) {
      return;
    }

    const ticket = await this.getTicketById(ticketId);

    if (!ticket) {
      return;
    }

    /**
     * Customer ACKED.
     *
     * The ticket stays in this.tickets
     * for history, but leaves the active
     * waiting rotation.
     */
    ticket.status = 'ACKNOWLEDGED';

    this.emitStatusUpdated(ticket);

    const slot = await this.getSlot(slotId);

    if (slot) {
      slot.status = 'OCCUPIED';
    }

    /**
     * Delete only the rotation state.
     *
     * DO NOT delete the ticket.
     */
    this.rotations.delete(slotId);

    this.contactAttempts.delete(ticket.ticketId);

    this.logger.log(
      `[Queue] Ticket ${ticket.ticketId} ACKNOWLEDGED. ` +
        `Slot ${slotId} is now OCCUPIED.`,
    );

    return ticket;
  }

  // ============================================================
  // CONTACT TIMEOUT / NO ACK
  // ============================================================

  @OnEvent(EVENTS.CONTACT_TIMEOUT)
  async handleContactTimeout(payload: ContactOutcomePayload) {
    const slotId = payload.slotId;

    const rotation = this.rotations.get(slotId);

    if (!rotation) {
      this.logger.warn(`[Queue] No active rotation found for slot ${slotId}`);

      return;
    }

    const currentTicketId =
      rotation.candidateTicketIds[rotation.currentIndex];

    if (!currentTicketId) {
      return;
    }

    const currentTicket = await this.getTicketById(currentTicketId);

    if (!currentTicket) {
      return;
    }

    const attempts = this.contactAttempts.get(currentTicket.ticketId) ?? 0;

    // ========================================================
    // CASE 1: MAX NO-ACK ATTEMPTS -> NO_SHOW
    // ========================================================

    if (attempts >= this.MAX_TICKET_CONTACT_ATTEMPTS) {
      /**
       * Customer becomes NO_SHOW.
       *
       * IMPORTANT:
       *
       * We DO NOT remove the ticket
       * from this.tickets.
       *
       * We only remove it from the
       * active rotation by rebuilding
       * the rotation from WAITING tickets.
       */
      currentTicket.status = 'NO_SHOW';

      this.emitStatusUpdated(currentTicket);

      this.logger.log(
        `[Queue] Ticket ${currentTicket.ticketId} ` +
          `reached ${this.MAX_TICKET_CONTACT_ATTEMPTS} contact attempts. ` +
          `Marked as NO_SHOW. ` +
          `Ticket remains in queue history.`,
      );

      /**
       * Contact attempts are no longer needed
       * because this ticket is permanently inactive.
       */
      this.contactAttempts.delete(currentTicket.ticketId);

      /**
       * Rebuild the rotation from
       * the current active WAITING queue.
       *
       * Example:
       *
       * A B C D E
       *
       * A -> NO_SHOW
       *
       * New active queue:
       * B C D E
       *
       * New rotation:
       * B C D
       */
      await this.rebuildRotationAfterRemoval(
        slotId,
        currentTicket.ticketId,
      );

      const updatedRotation = this.rotations.get(slotId);

      if (
        !updatedRotation ||
        updatedRotation.candidateTicketIds.length === 0
      ) {
        this.rotations.delete(slotId);

        this.logger.log(
          `[Queue] No active waiting customers remain for slot ${slotId}.`,
        );

        return {
          currentTicket,
          nextTicket: undefined,
          rotation: undefined,
        };
      }

      /**
       * Start the newly rebuilt rotation
       * from its first candidate.
       */
      const nextTicket = await this.callNextCandidate(slotId);

      return {
        currentTicket,
        nextTicket,
        rotation: updatedRotation,
      };
    }

    // ========================================================
    // CASE 2: NO ACK BUT CUSTOMER STILL ACTIVE
    // ========================================================

    /**
     * Customer did NOT ACK,
     * but still has remaining attempts.
     *
     * Return customer to WAITING.
     *
     * DO NOT rebuild the rotation.
     *
     * Example:
     *
     * A B C D E
     *
     * Rotation:
     * A B C
     *
     * A -> NO ACK
     * A becomes WAITING
     *
     * Next:
     * B
     *
     * Rotation remains:
     * A B C
     *
     * Cycle:
     * A -> B -> C -> A -> B -> C
     */
    currentTicket.status = 'WAITING';

    this.emitStatusUpdated(currentTicket);

    rotation.currentIndex =
      (rotation.currentIndex + 1) % rotation.candidateTicketIds.length;

    const nextTicket = await this.callNextCandidate(slotId);

    return {
      currentTicket,
      nextTicket,
      rotation,
    };
  }

  // ============================================================
  // SIMULATION ENDPOINT HELPER
  // ============================================================

  async simulateAck(slotId: string, acknowledged: boolean) {
    const rotation = this.rotations.get(slotId);

    if (!rotation) {
      throw new Error(`No active rotation for slot ${slotId}.`);
    }

    const currentTicketId =
      rotation.candidateTicketIds[rotation.currentIndex];

    const currentTicket = currentTicketId
      ? await this.getTicketById(currentTicketId)
      : undefined;

    if (!currentTicket) {
      throw new Error(`Current rotation ticket not found.`);
    }

    if (acknowledged) {
      const result = await this.handleContactAck({
        slotId,
        ticketId: currentTicket.ticketId,
        acknowledged: true,
      } as ContactOutcomePayload);

      return {
        acknowledged: true,
        currentTicket: result,
        nextTicket: undefined,
        attempts:
          this.contactAttempts.get(currentTicket.ticketId) ?? 0,
      };
    }

    const result = await this.handleContactTimeout({
      slotId,
      ticketId: currentTicket.ticketId,
      acknowledged: false,
    } as ContactOutcomePayload);

    return {
      acknowledged: false,
      currentTicket: result?.currentTicket,
      nextTicket: result?.nextTicket,
      attempts:
        result?.currentTicket?.status === 'NO_SHOW'
          ? this.MAX_TICKET_CONTACT_ATTEMPTS
          : (this.contactAttempts.get(
                result?.currentTicket?.ticketId ?? currentTicket.ticketId,
              ) ?? 0),
      rotation: result?.rotation,
    };
  }
}