import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { CheckInService } from '../checkin/checkin.service';
import { EVENTS } from '../common/events';
import { SapLookupResultDto } from '../common/dtos/sap-lookup-result.dto';
import { SessionService } from './session.service';
import { KioskGateway } from './kiosk.gateway';
import { ElevenLabsTtsAdapter, INluAdapter, ISttAdapter, ITtsAdapter, NluRulesAdapter } from 'src/ai';
import { KioskStateEnum } from './enum/VoiceStateEnum';
import { ConfirmingPhoneDto } from './interfaces/ConfirmingPhoneDto';
import { KioskSession } from './interfaces/kiosk-session.interface';
import { AskingPhoneDto } from './interfaces/AskingPhoneDto';

export type VoiceState = 'IDLE' | 'GREETING' | 'CONFIRMING_CUSTOMER' | 'CHECKING_IN' | 'COMPLETED';

@Injectable()
export class KioskService {
  private readonly logger = new Logger(KioskService.name);
  private currentState: KioskStateEnum = KioskStateEnum.IDLE;

  constructor(
    private readonly configService: ConfigService,
    private readonly checkInService: CheckInService,
    private readonly sessionService: SessionService,
    @Inject(forwardRef(() => KioskGateway))private readonly kioskGateway:KioskGateway,
    @Inject('ITtsAdapter')private readonly ttsAdapter:ITtsAdapter,
    @Inject('ISttAdapter')private readonly sttAdapter:ISttAdapter,
    @Inject('INluAdapter')private readonly nluAdapter:INluAdapter,
    private readonly eventemitter:EventEmitter2
  ) {}

  getState(): KioskStateEnum {
    return this.currentState;
  }

  @OnEvent(EVENTS.SAP_LOOKUP_RESULT)
  async handleSapLookupResult(payload: SapLookupResultDto) {
    const activeApproach = this.configService.get<string>('ACTIVE_APPROACH', 'voice');
    if (activeApproach.toLowerCase() !== 'voice') {
      this.logger.debug(`[KioskService] Ignoring SAP result for ${payload.plate} - active approach is '${activeApproach}'`);
      return;
    }

    this.logger.log(`[KioskService] Processing active Voice kiosk state for plate: ${payload.plate}`);

   const session = await this.sessionService.createSession({
  gateId: payload.gateId,
  plateNo: payload.plate,
  customerName: payload.found ? payload.profile?.name ?? null : null,
  phone: payload.found ? payload.profile?.phone ?? null : null,
  currentState: payload.found
    ? KioskStateEnum.GREETING
    : KioskStateEnum.DATA_ASKING,
});
 
this.logger.log(
  `[KioskService] Session created: ${session.sessionId}`,
);
await this.Greeting(session)

// this.currentState = 'GREETING';

    // Auto trigger check-in submission for Voice flow baseline (Sara's state machine will expand this)
    // await this.checkInService.submit({
    //   gateId: 'gate-1',
    //   plate: payload.plate,
    //   name: payload.profile?.name || 'Voice Customer',
    //   phone: payload.profile?.phone || '+966500000000',
    //   source: 'VOICE',
    // });

    // this.currentState = 'COMPLETED';
  }
@OnEvent(EVENTS.CONFIRMING_PHONE)
async handleConfirmingPhone(payload: ConfirmingPhoneDto) {
  // 1. STT
  const transcript = await this.sttAdapter.transcribe(payload.audio);

  // 2. NLU
  const result = await this.nluAdapter.parse(transcript);

  this.logger.log('[KioskService] Transcript:', transcript);
  this.logger.log('[KioskService] NLU result:', result);

  // 3. Decide based on intent
  if (result.intent === 'YES') {
    // open gate
  }

  if (result.intent === 'NO') {
    const audio=await this.ttsAdapter.synthesize("ما هو رقمك؟")
    const message="ما هو رقمك؟"
    const data:AskingPhoneDto={
      gateId:payload.gateId,
      session:payload.sessionId,
      audio,
      message
    }
    this.eventemitter.emit(EVENTS.ASKING_ABOUT_PHONE,data)
  }
}


Greeting=async(session:KioskSession)=>{
const audio = await this.ttsAdapter.synthesize(`أهلاً بك ${session.customerName} رقمك هو ${session.phone} فقط قل نعم او لا`);
//this.logger.log('TTS audio size:', audio.length, 'bytes');
    this.kioskGateway.sendGreeting({
    sessionId: session.sessionId,
    state: KioskStateEnum.GREETING,
    message:`أهلاً بك ${session.customerName} رقمك هو ${session.phone} فقط قل نعم او لا`,
    audio,
    gateId:session.gateId
  });
//   console.log('[KioskService] About to send greeting');
// console.log('[KioskService] gateId:', session.gateId);
// console.log('[KioskService] sessionId:', session.sessionId);
}


}

