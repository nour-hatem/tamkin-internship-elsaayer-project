import { ContactMethod } from "@common/enums/contactMethod.enum";
import { ContactStatus } from "@common/enums/contactStatus.enum";

export interface ContactResult {
  ticketId: string;
  method: ContactMethod;
  status: ContactStatus;
}