import { ContactResult } from '@common/dtos/contact-result.dto';
import { IContactAdapter } from '../ports/contact.port';
import { Notification } from '@common/dtos/notification.dto';

export class CallingAgentAdapter implements IContactAdapter {
  async send(notification: Notification): Promise<ContactResult> {
    console.log(
      `CALLING AGENT SIMULATED TO ${notification.phone}`
    );

    return {
      ticketId: notification.ticketId,
      status: 'SENT',
      method: 'CALLING_AGENT',
    };
  }
}