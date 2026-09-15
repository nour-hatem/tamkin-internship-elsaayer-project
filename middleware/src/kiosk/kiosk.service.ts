import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';

import { EVENTS } from '../common/events';
import { SapLookupResultDto } from '../common/dtos/sap-lookup-result.dto';

import { SessionService } from './session.service';
import { KioskGateway } from './kiosk.gateway';
import { KioskStateEnum } from './enum/VoiceStateEnum';
import {inputModeEnum} from './enum/InputModeEnum'

import {
  INluAdapter,
  ISttAdapter,
  ITtsAdapter,
} from 'src/ai';

import { KioskSession } from './interfaces/kiosk-session.interface';
import { KioskInputDto } from './interfaces/KioskInputDto';
import { ISapAdapter } from 'src/sap/ports/sap.port';
import { IGateAdapter } from 'src/gate/ports/gate.port';
import { CheckInService } from 'src/checkin/checkin.service';


@Injectable()
export class KioskService {
  private readonly logger = new Logger(KioskService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
    private readonly checkinService:CheckInService,
    @Inject(forwardRef(() => KioskGateway))
    private readonly kioskGateway: KioskGateway,
    @Inject('ITtsAdapter')
    private readonly ttsAdapter: ITtsAdapter,
    @Inject('ISttAdapter')
    private readonly sttAdapter: ISttAdapter,
    @Inject('INluAdapter')
    private readonly nluAdapter: INluAdapter,
    @Inject('IGateAdapter')
  private readonly gateAdapter: IGateAdapter,
  private readonly eventEmitter: EventEmitter2,
      ) {}

  /**
   * Starts the kiosk flow after SAP finishes looking up the plate.
   */
  @OnEvent(EVENTS.SAP_LOOKUP_RESULT)
  async handleSapLookupResult(payload: SapLookupResultDto) {
    const activeApproach = this.configService.get<string>(
      'ACTIVE_APPROACH',
      'voice',
    );

    if (activeApproach.toLowerCase() !== 'voice') {
      this.logger.debug(
        `[KioskService] Ignoring SAP result for ${payload.plate} - ` +
        `active approach is '${activeApproach}'`,
      );
      return;
    }

    this.logger.log(
      `[KioskService] Processing Voice kiosk flow for plate: ${payload.plate}`,
    );

    const socketId = this.kioskGateway.getKioskSocketIdForGate(payload.gateId);

    const session = await this.sessionService.createSession({
      gateId: payload.gateId,
      plateNo: payload.plate,
      socketId,

      customerName: payload.found
        ? payload.profile?.name ?? null
        : null,

      phone: payload.found
        ? payload.profile?.phone ?? null
        : null,

      currentState: payload.found
        ? KioskStateEnum.GREETING
        : KioskStateEnum.NAME_ASKING,

      confirmationRetries: 0,

      phoneRetries: 0,
    });


    this.logger.log(
      `[KioskService] Session created: ${session.sessionId}`,
    );

    if (payload.found) {
      await this.greeting(session);
    }else{
      await this.askForName(session)
    }
  }

  /**
   * Receives all audio input from the frontend.
   *
   * The session state determines what this audio means.
   * We do NOT trust the state sent by the frontend.
   */
  @OnEvent(EVENTS.KIOSK_INPUT)
  async handleInput(payload: KioskInputDto) {
    const session = await this.sessionService.getSession(
      payload.sessionId,
    );

    if (!session) {
      this.logger.warn(
        `[KioskService] Session not found: ${payload.sessionId}`,
      );
      return;
    }

    this.logger.log(
      `[KioskService] INPUT received - ` +
      `session=${session.sessionId}, ` +
      `state=${session.currentState}`,
    );

    switch (session.currentState) {
      case KioskStateEnum.CONFIRMING_PHONE:
        await this.handlePhoneConfirmation(session, payload);
        break;

      case KioskStateEnum.PHONE_ASKING:
        await this.handlePhoneInput(session, payload);
        break;
      case KioskStateEnum.NAME_ASKING:
        await this.handleNameInput(session, payload);
        break;  

      default:
        this.logger.warn(
          `[KioskService] INPUT received in unsupported state: ` +
          `${session.currentState}`,
        );
    }
  }

  /**
   * Handles the customer's YES / NO answer
   * during phone-number confirmation.
   */
 
    // 1. Convert customer's audio to text.
    private async handlePhoneConfirmation(
  session: KioskSession,
  payload: KioskInputDto,
) {
  let transcript: string;

  if (payload.text) {
    transcript = payload.text.trim();
  } else if (payload.audio) {
    transcript = await this.sttAdapter.transcribe(
      payload.audio,
    );
  } else {
    this.logger.warn(
      `[KioskService] No audio or text provided for phone confirmation`,
    );
    return;
  }

  this.logger.log(
    `[KioskService] Confirmation input: ${transcript}`,
  );

      // 2. Understand the customer's answer.
    const result = await this.nluAdapter.parse(
      transcript,
    );

    this.logger.log(
      `[KioskService] NLU result: ${JSON.stringify(result)}`,
    );

    // 3. Customer confirmed the phone number.
    if (result.intent === 'YES') {
      await this.complete(session);
      return;
    }

    // 4. Customer rejected the phone number.
 if (result.intent === 'NO') {
  await this.sessionService.updateSession(
    session.sessionId,
    {
      confirmationRetries: 0,
    },
  );

  await this.askForPhone(session);
  return;
}


    // 5. Unknown answer.
    if (result.intent === 'UNKNOWN') {
  if (session.confirmationRetries === 0) {
    await this.sessionService.updateSession(
      session.sessionId,
      {
        confirmationRetries: 1,
      },
    );

    await this.greeting(session);
    return;
  }

  await this.showConfirmationButtons(session);
  return;
}

    // Retry behavior will be implemented later.
  }

private async handleNameInput(
  session: KioskSession,
  payload: KioskInputDto,
) {
  this.logger.log(
    `[KioskService] Name input received for session ${session.sessionId}`,
  );

  const name = payload.text?.trim();

  if (!name) {
    this.logger.warn(
      `[KioskService] Customer name was not provided`,
    );
    return;
  }

  this.logger.log(
    `[KioskService] Customer name received: ${name}`,
  );

  const updatedSession = await this.sessionService.updateSession(
    session.sessionId,
    {
      customerName: name,
    },
  );

  await this.askForPhone(updatedSession);
}

  /**
   * Handles audio received after the backend asked
   * the customer for their phone number.
   *
   * We will implement this in the next step.
   */
  private async handlePhoneInput(
    session: KioskSession,
    payload: KioskInputDto,
  ) {
    this.logger.log(
      `[KioskService] Phone input received for session ${session.sessionId}`,
    );

    // 1. Convert customer's audio to text.
    let transcript: string;

if (payload.text) {
  transcript = payload.text.trim();
} else if (payload.audio) {
  transcript = await this.sttAdapter.transcribe(
    payload.audio,
  );
} else {
  this.logger.warn(
    `[KioskService] No audio or text provided for phone input`,
  );
  return;
}

    this.logger.log(
      `[KioskService] Transcript: ${transcript}`,
    );

    // 2. Understand the customer's answer.
    const result = await this.nluAdapter.parse(
      transcript,
    );

    this.logger.log(
      `[KioskService] NLU result: ${JSON.stringify(result)}`,
    );

      // 3. Make sure NLU actually detected a phone number.
 if (result.intent === 'UNKNOWN') {
  if (session.phoneRetries === 0) {
    await this.sessionService.updateSession(
      session.sessionId,
      {
        phoneRetries: 1,
      },
    );

    await this.askForPhone(session);
    return;
  }

  await this.showPhoneKeyboard(session);
  return;
}

  // 4. Get the phone number extracted by NLU.

       const phone =
       result.intent === 'PHONE' && result.entities?.phone != null
         ? String(result.entities.phone)
         : '';


  if (!phone) {
    this.logger.warn(
      `[KioskService] NLU returned PHONE intent without a phone entity`,
    );

    return;
  }

  this.logger.log(
    `[KioskService] Phone number extracted: ${phone}`,
  );

  // 5. Save the phone number in the session.
  const updatedSession = await this.sessionService.updateSession(
  session.sessionId,
  {
    phone,
    phoneRetries: 0,
  },
);

  //6.Confirm the phone again
  await this.greeting(updatedSession)

  // 6. Continue to the next check-in step.
 // await this.continueCheckIn(session, phone);
  }

  /**
   * Sends the greeting and moves the session
   * to the phone-confirmation state.
   */
  private async greeting(session: KioskSession) {
    const message =
      `أهلاً بك ${session.customerName} ` +
      `رقمك هو ${session.phone} ` +
      `فقط قل نعم او لا`;

    const audio = await this.ttsAdapter.synthesize(
      message,
    );

    // The greeting has been sent.
    // The next thing we expect from the customer
    // is YES or NO.
    await this.sessionService.updateSession(
      session.sessionId,
      {
        currentState: KioskStateEnum.CONFIRMING_PHONE,
      },
    );

    this.kioskGateway.sendOutput({
      sessionId: session.sessionId,
      gateId: session.gateId,
      state: KioskStateEnum.CONFIRMING_PHONE,
      message,
      audio,
      inputMode:inputModeEnum.VOICE
    });
  }


  private async askForName(session: KioskSession){
    const message =
    'أهلاً بك، من فضلك أدخل اسمك'

      const audio = await this.ttsAdapter.synthesize(
      message,
    );

    await this.sessionService.updateSession(
      session.sessionId,
      {
        currentState: KioskStateEnum.NAME_ASKING,
      },
    );

      this.kioskGateway.sendOutput({
      sessionId: session.sessionId,
      gateId: session.gateId,
      state: KioskStateEnum.NAME_ASKING,
      message,
      audio,
      inputMode:inputModeEnum.TEXT
    });


  }

  private async complete(session: KioskSession) {
    this.logger.log(
      `[KioskService] Customer confirmed phone for session ${session.sessionId}`,
    );

    const transitionResult = await this.sessionService.transitionState(
      session.sessionId,
      KioskStateEnum.CONFIRMING_PHONE,
      KioskStateEnum.CHECKING_IN,
    );

    if (transitionResult.status !== 'SUCCESS') {
      this.logger.warn(
        `[KioskService] State transition to CHECKING_IN failed/rejected for session ${session.sessionId}: ${transitionResult.status}` +
          (transitionResult.status === 'STATE_MISMATCH'
            ? ` (current state: ${transitionResult.currentState})`
            : ''),
      );
      return;
    }

    // try {
    //   const gateOpened = await this.gateAdapter.openGate(session.gateId);
    //   if (!gateOpened) {
    //     throw new Error(`Gate ${session.gateId} did not open`);
    //   }

    //   this.logger.log(
    //     `[KioskService] Gate ${session.gateId} opened successfully`,
    //   );

    //   await this.sessionService.updateSession(
    //     session.sessionId,
    //     {
    //       currentState: KioskStateEnum.COMPLETED,
    //       confirmationRetries: 0,
    //     },
    //   );

    //   this.eventEmitter.emit(
    //     EVENTS.CHECKIN_COMPLETED,
    //     {
    //       sessionId: session.sessionId,
    //       gateId: session.gateId,
    //       gateOpened: true,
    //     },
    //   );
    // } 
try{
await this.checkinService.submit({
  
  gateId:session.gateId,
  plate: session.plateNo,
  name: session.customerName,
  phone: session.phone,
  source: 'VOICE',
})
}

    catch (error) {
      this.logger.error(
        `[KioskService] Failed to open gate ${session.gateId}`,
        error,
      );

      // Keep the session in CHECKING_IN for now.
      // We can define the failure/retry behavior separately.
      this.eventEmitter.emit(
        EVENTS.CHECKIN_COMPLETED,
        {
          sessionId: session.sessionId,
          gateId: session.gateId,
          gateOpened: false,
        },
      );
    }

    return;
  }

    /**
   * Asks the customer for their phone number.
   */
  private async askForPhone(session: KioskSession) {
    const message = 'ما هو رقمك؟';

    const audio = await this.ttsAdapter.synthesize(
      message,
    );

    // The next input from the frontend should be
    // interpreted as a phone number.
    await this.sessionService.updateSession(
      session.sessionId,
      {
        currentState: KioskStateEnum.PHONE_ASKING,
      },
    );

    this.kioskGateway.sendOutput({
      sessionId: session.sessionId,
      gateId: session.gateId,
      state: KioskStateEnum.PHONE_ASKING,
      message,
      audio,
      inputMode:inputModeEnum.VOICE
    });
  }

  private async showConfirmationButtons(session: KioskSession) {
  const message = 'من فضلك اضغط على الإجابة';

  const audio = await this.ttsAdapter.synthesize(message);

  await this.sessionService.updateSession(
    session.sessionId,
    {
      currentState: KioskStateEnum.CONFIRMING_PHONE,
    },
  );

  this.kioskGateway.sendOutput({
    sessionId: session.sessionId,
    gateId: session.gateId,
    state: KioskStateEnum.CONFIRMING_PHONE,
    message,
    audio,
    inputMode:inputModeEnum.BUTTONS
  });
}

private async showPhoneKeyboard(session: KioskSession) {
  const message = 'من فضلك أدخل رقم هاتفك';

  const audio = await this.ttsAdapter.synthesize(message);

  await this.sessionService.updateSession(
    session.sessionId,
    {
      currentState: KioskStateEnum.PHONE_ASKING,
    },
  );

  this.kioskGateway.sendOutput({
    sessionId: session.sessionId,
    gateId: session.gateId,
    state: KioskStateEnum.PHONE_ASKING,
    message,
    audio,
    inputMode: inputModeEnum.TEXT,
  });
}
}