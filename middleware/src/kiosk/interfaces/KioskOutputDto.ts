
import { inputModeEnum } from "../enum/InputModeEnum";
import { KioskStateEnum } from "../enum/VoiceStateEnum";

export interface KioskOutputDto {
  sessionId: string;
  gateId: string;
  state: KioskStateEnum;
  message: string;
  audio: Buffer;
  inputMode: inputModeEnum
}