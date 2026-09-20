import { ContactResult } from "@common/dtos/contact-result.dto";
import { IContactAdapter } from "../ports/contact.port";
import { Notification } from "@common/dtos/notidication.dto";

export class SmsAdapter implements IContactAdapter {
  async send(notification: Notification): Promise<ContactResult> {
   console.log(
      `ELSAYER APP MESSAGE IS SIMULATED TO ${notification.phone}`
    );

    return {
      ticketId: notification.ticketId,
      status: 'SENT',
      method: 'SMS',
    };
  }
}


