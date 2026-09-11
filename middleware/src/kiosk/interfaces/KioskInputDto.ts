import { KioskStateEnum } from '../enum/VoiceStateEnum';

export class KioskInputDto {
  sessionId: string;
  gateId: string;
  state: KioskStateEnum;
  audio?: Buffer;
  text?:string;
}