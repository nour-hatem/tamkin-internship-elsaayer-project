import { ContactMethod } from '../../ai';

export interface CheckInRequestDto {
  gateId: string;
  plate: string;
  name: string;
  phone: string;
  source: 'QR' | 'VOICE';
  preferredContactMethod: ContactMethod;
  ToyotaCustomer:boolean
}
