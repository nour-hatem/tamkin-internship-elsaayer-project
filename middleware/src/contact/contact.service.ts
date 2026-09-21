import { ContactMethod } from '@common/enums/contactMethod.enum';
import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IContactAdapter } from './ports/contact.port';
import { SmsAdapter } from './adapters/SMS.adapter';
import { whatsappAdapter } from './adapters/whatsapp.adapter';
import { ElsaayerAppAdapter } from './adapters/elsayerApp.adapter';
import { CallingAgentAdapter } from './adapters/callingAgent.adapter';
import { QueueTicket } from 'src/queue/queue.service';
import { ContactResult } from '@common/dtos/contact-result.dto';
import { Notification } from '@common/dtos/notification.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EVENTS } from '@common/events';
import { ContactOutcomePayload } from '@common/typed-event-emitter.service';



interface PendingContact {
  ticketId: string;
  method: ContactMethod;
  timer: NodeJS.Timeout;
  slotId:string
}

@Injectable()
export class ContactService {
  private readonly adapters: Record<
    ContactMethod,
    IContactAdapter
  >;

  private readonly pendingContacts =
    new Map<string, PendingContact>();

  constructor(
    private readonly smsAdapter: SmsAdapter,
    private readonly whatsappAdapter: whatsappAdapter,
    private readonly elsaayerAppAdapter: ElsaayerAppAdapter,
    private readonly callingAgentAdapter: CallingAgentAdapter,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.adapters = {
      SMS: this.smsAdapter,
      WHATSAPP: this.whatsappAdapter,
      ELSAAYER_APP: this.elsaayerAppAdapter,
      CALLING_AGENT: this.callingAgentAdapter,
    };
  }

  async notify({ticketId,slotId,phone,name ,preferredContactMethod}:{ticketId:string,slotId:string,phone:string,name:string ,preferredContactMethod:ContactMethod}): Promise<ContactResult> {
    const method = preferredContactMethod;

    const adapter = this.adapters[method];

    if (!adapter) {
      throw new Error(
        `No contact adapter found for method: ${method}`,
      );
    }

    const notification: Notification = {
      ticketId,
      phone,
      name,
      message: 'Your slot is available.',
    };

        // Send the simulated notification
    const result = await adapter.send(notification);

    // Start the 30-second ACK timer
    if (result.status === 'SENT') {
      this.startAcknowledgmentTimeout({
        ticketId,
        slotId},
        method,
      );
    }

    return result;
  }

 acknowledge(ticketId: string, slotId: string): ContactResult {
  const pending = this.pendingContacts.get(ticketId);

  if (!pending) {
    throw new NotFoundException(`No pending contact found for ticket ${ticketId}`);
  }

  // Guard against a mismatched slotId from the client
  if (pending.slotId !== slotId) {
    throw new NotFoundException(
      `Ticket ${ticketId} is pending for slot ${pending.slotId}, not ${slotId}`,
    );
  }

  clearTimeout(pending.timer);
  this.pendingContacts.delete(ticketId);

  this.eventEmitter.emit(EVENTS.CONTACT_ACK, {
    ticketId,
    slotId: pending.slotId, // use the stored value, not the raw input
  } satisfies ContactOutcomePayload);

  return {
    ticketId,
    method: pending.method,
    status: 'ACKNOWLEDGED',
  };
}

private startAcknowledgmentTimeout(
  { ticketId, slotId }: { ticketId: string; slotId: string },
  method: ContactMethod,
): void {
  const timer = setTimeout(() => {
    this.handleNoResponse({ ticketId, slotId });
  }, 30_000);

  this.pendingContacts.set(ticketId, {
    ticketId,
    slotId,
    method,
    timer,
  });
}

  private handleNoResponse({ticketId,slotId}:ContactOutcomePayload): void {
    const pending = this.pendingContacts.get(ticketId);

    if (!pending) {
      return;
    }

    this.pendingContacts.delete(ticketId);

    console.log(
      `Ticket ${ticketId} -> NO_RESPONSE`,
    );

    // Later:
    // Notify QueueService that this customer
    // did not respond.
    this.eventEmitter.emit(EVENTS.CONTACT_TIMEOUT, {
  ticketId,
  slotId,
} satisfies ContactOutcomePayload);  
  }
}