import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';

import { EVENTS } from '../common/events';
import { SapLookupResultDto } from '../common/dtos/sap-lookup-result.dto';

import { SessionService } from './session.service';
import { KioskGateway } from './kiosk.gateway';
import { KioskStateEnum } from './enum/VoiceStateEnum';

import {
  INluAdapter,
  ISttAdapter,
  ITtsAdapter,
} from 'src/ai';

import { KioskSession } from './interfaces/kiosk-session.interface';
import { KioskInputDto } from './interfaces/KioskInputDto';
import { ISapAdapter } from 'src/sap/ports/sap.port';
import { IGateAdapter } from 'src/gate/ports/gate.port';

@Injectable()
export class KioskService {
  private readonly logger = new Logger(KioskService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
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

    const session = await this.sessionService.createSession({
      gateId: payload.gateId,
      plateNo: payload.plate,

      customerName: payload.found
        ? payload.profile?.name ?? null
        : null,

      phone: payload.found
        ? payload.profile?.phone ?? null
        : null,

      currentState: payload.found
        ? KioskStateEnum.GREETING
        : KioskStateEnum.NAME_ASKING,
    });

    this.logger.log(
      `[KioskService] Session created: ${session.sessionId}`,
    );

    if (payload.found) {
      await this.greeting(session);
    }else{
      await this.askForName(session)
    }

    // DATA_ASKING will be implemented separately.
    // For now, the session is created with DATA_ASKING state.
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
  private async handlePhoneConfirmation(
    session: KioskSession,
    payload: KioskInputDto,
  ) {
    // 1. Convert customer's audio to text.
    const transcript = await this.sttAdapter.transcribe(
      payload.audio,
    );

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

    // 3. Customer confirmed the phone number.
if (result.intent === 'YES') {
  await this.complete(session)
}

    // 4. Customer rejected the phone number.
    if (result.intent === 'NO') {
      await this.askForPhone(session);
      return;
    }

    // 5. Unknown answer.
    this.logger.warn(
      `[KioskService] Could not understand confirmation answer`,
    );

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
    const transcript = await this.sttAdapter.transcribe(
      payload.audio,
    );

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
  if (result.intent !== 'PHONE') {
    this.logger.warn(
      `[KioskService] Could not extract a valid phone number`,
    );

    // TODO:
    // Ask the customer to provide the phone number again.
    return;
  }

  // 4. Get the phone number extracted by NLU.
  const phone = (result.entities?.phone).toString();

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
  const updatedSession=await this.sessionService.updateSession(
    session.sessionId,
    {
      phone,
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
    });


  }

  private async complete(session:KioskSession){
    this.logger.log(
    `[KioskService] Customer confirmed phone for session ${session.sessionId}`,
  );

  await this.sessionService.updateSession(
    session.sessionId,
    {
      currentState: KioskStateEnum.CHECKING_IN,
    },
  );

  try {
    await this.gateAdapter.openGate(session.gateId);

    this.logger.log(
      `[KioskService] Gate ${session.gateId} opened successfully`,
    );

    await this.sessionService.updateSession(
      session.sessionId,
      {
        currentState: KioskStateEnum.COMPLETED,
      },
    );

    this.eventEmitter.emit(
      EVENTS.CHECKIN_COMPLETED,
      {
        sessionId: session.sessionId,
        gateId: session.gateId,
        gateOpened: true,
      },
    );
  } catch (error) {
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
    });
  }
}