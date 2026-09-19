import { Injectable, Logger } from '@nestjs/common';
import { ContactMethod } from '../ai';

export interface QueueTicket {
  ticketId: string;
  gateId: string;
  plate: string;
  name: string;
  phone: string;
  source: 'QR' | 'VOICE';
  status: 'QUEUED' | 'IN_SERVICE' | 'COMPLETED';
  contactMethod?: ContactMethod | null;
  createdAt: Date;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private tickets: QueueTicket[] = [];
  private ticketCounter = 1000;

  async enqueue(
    gateId: string,
    plate: string,
    name: string,
    phone: string,
    source: 'QR' | 'VOICE',
    contactMethod?: ContactMethod | null,
  ): Promise<QueueTicket> {
    this.ticketCounter += 1;
    const ticketId = `TICK-${this.ticketCounter}`;

    const ticket: QueueTicket = {
      ticketId,
      gateId,
      plate,
      name,
      phone,
      source,
      contactMethod: contactMethod ?? null,
      status: 'QUEUED',
      createdAt: new Date(),
    };

    this.tickets.push(ticket);
    this.logger.log(`[QueueService] Ticket created: ${ticketId} for ${name} (${plate}) via ${source}`);
    return ticket;
  }

  async getActiveTicketForPlate(plate: string): Promise<QueueTicket | undefined> {
    return this.tickets.find(
      (t) => t.plate?.toLowerCase() === plate?.toLowerCase() && t.status === 'QUEUED',
    );
  }

  async getAllTickets(): Promise<QueueTicket[]> {
    return this.tickets;
  }
}
