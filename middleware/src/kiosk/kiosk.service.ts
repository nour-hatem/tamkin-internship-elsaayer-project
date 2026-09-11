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
        : KioskStateEnum.DATA_ASKING,
    });

    this.logger.log(
      `[KioskService] Session created: ${session.sessionId}`,
    );

    if (payload.found) {
      await this.greeting(session);
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
      // TODO:
      // Update session state.
      // Continue check-in.
      // Open gate.
      return;
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

    // TODO:
    // STT -> NLU -> extract phone number
    // update session
    // continue check-in flow
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
}