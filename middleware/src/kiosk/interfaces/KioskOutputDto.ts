import { KioskStateEnum } from "../enum/VoiceStateEnum";

export interface KioskOutputDto {
  sessionId: string;
  gateId: string;
  state: KioskStateEnum;
  message: string;
  audio: Buffer;
}