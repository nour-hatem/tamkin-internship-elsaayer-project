import { ContactResult } from "@common/dtos/contact-result.dto";
import { Notification } from "@common/dtos/notidication.dto";


export interface IContactAdapter {
  send(notification: Notification): Promise<ContactResult>;
}

export const CONTACT_ADAPTER_TOKEN = 'CONTACT_ADAPTER_TOKEN';