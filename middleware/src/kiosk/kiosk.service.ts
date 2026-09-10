import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { CheckInService } from '../checkin/checkin.service';
import { EVENTS } from '../common/events';
import { SapLookupResultDto } from '../common/dtos/sap-lookup-result.dto';
import { SessionService } from './session.service';
import { KioskGateway } from './kiosk.gateway';
import { ElevenLabsTtsAdapter, ITtsAdapter } from 'src/ai';
import { KioskStateEnum } from './enum/VoiceStateEnum';

export type VoiceState = 'IDLE' | 'GREETING' | 'CONFIRMING_CUSTOMER' | 'CHECKING_IN' | 'COMPLETED';

@Injectable()
export class KioskService {
  private readonly logger = new Logger(KioskService.name);
  private currentState: KioskStateEnum = KioskStateEnum.IDLE;

  constructor(
    private readonly configService: ConfigService,
    private readonly checkInService: CheckInService,
    private readonly sessionService: SessionService,
    private readonly kioskGateway:KioskGateway,
    @Inject('ITtsAdapter')private readonly ttsAdapter:ITtsAdapter
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
 
await this.Greeting(session)



this.logger.log(
  `[KioskService] Session created: ${session.sessionId}`,
);



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


Greeting=async(session)=>{
const audio = await this.ttsAdapter.synthesize(`أهلاً بك ${session.customerName} رقمك هو ${session.phone} فقط قل نعم او لا`);

  this.kioskGateway.sendGreeting({
    sessionId: session.sessionId,
    state: KioskStateEnum.GREETING,
    message:`أهلاً بك ${session.customerName} رقمك هو ${session.phone} فقط قل نعم او لا`,
    audio,
    gateId:session.gateId
  });
}
}

