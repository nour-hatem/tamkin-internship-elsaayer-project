import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EVENTS } from './events';
import { PlateReadDto } from './dtos/plate-read.dto';
import { SapLookupResultDto } from './dtos/sap-lookup-result.dto';
import { CheckInRequestDto } from './dtos/checkin-request.dto';
import { CheckInResultDto } from './dtos/checkin-result.dto';

export interface CheckinSubmittedPayload {
  gateId: string;
  plate: string;
  name: string;
  phone: string;
  source: 'QR' | 'VOICE';
  preferredContactMethod: CheckInRequestDto['preferredContactMethod'];
  queueEntryId: string;
}

export interface EventPayloadMap {
  [EVENTS.PLATE_READ]: PlateReadDto;
  [EVENTS.SAP_LOOKUP_RESULT]: SapLookupResultDto;
  [EVENTS.CHECKIN_REQUEST]: CheckInRequestDto;
  [EVENTS.CHECKIN_SUBMITTED]: CheckinSubmittedPayload;
  [EVENTS.CHECKIN_DISPLAY_UPDATED]: {
    gateId: string;
    token: string | null;
  };
  [EVENTS.CHECKIN_COMPLETED]: CheckInResultDto;
  [EVENTS.GATE_OPEN]: {
    gateId: string;
    opened: boolean;
  };
  [EVENTS.KIOSK_STATE_CHANGED]: {
    gateId: string;
    state: string;
    data?: any;
  };
}

@Injectable()
export class TypedEventEmitter {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  emit<K extends keyof EventPayloadMap & string>(event: K, payload: EventPayloadMap[K]): boolean {
    return this.eventEmitter.emit(event, payload);
  }
}
