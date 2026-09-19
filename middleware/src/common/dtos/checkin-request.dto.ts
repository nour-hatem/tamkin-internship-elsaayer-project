export type ContactMethod = 'SMS' | 'WHATSAPP' | 'ELSAAYER_APP' | 'CALLING_AGENT';

export interface CheckInRequestDto {
  gateId: string;
  plate: string;
  name: string;
  phone: string;
  source: 'QR' | 'VOICE';
  preferredContactMethod: ContactMethod;
}
