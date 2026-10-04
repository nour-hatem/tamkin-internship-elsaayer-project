import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { KioskService } from './kiosk.service';
import { SessionService } from './session.service';
import { KioskGateway } from './kiosk.gateway';
import { CheckInService } from '../checkin/checkin.service';
import { KioskStateEnum } from './enum/VoiceStateEnum';
import { inputModeEnum } from './enum/InputModeEnum';
import { KioskSession } from './interfaces/kiosk-session.interface';
import { NluRulesAdapter } from '../ai/nlu/nlu-rules.adapter';
import {
  TTS_ADAPTER_TOKEN,
  STT_ADAPTER_TOKEN,
  NLU_ADAPTER_TOKEN,
} from '../ai';
import { GateService } from '../gate/gate.service';

describe('KioskService (Voice Contact Method Integration)', () => {
  let service: KioskService;
  let checkInService: { submit: jest.Mock };
  let kioskGateway: {
    sendOutput: jest.Mock;
    getKioskSocketIdForGate: jest.Mock;
  };
  let ttsAdapter: { synthesize: jest.Mock };
  let sttAdapter: { transcribe: jest.Mock };
  let nluAdapter: NluRulesAdapter;
  let sessions: Map<string, KioskSession>;

  beforeEach(async () => {
    sessions = new Map<string, KioskSession>();

    checkInService = {
      submit: jest.fn().mockResolvedValue({
        success: true,
        queueEntryId: 'TICK-1001',
      }),
    };

    kioskGateway = {
      sendOutput: jest.fn(),
      getKioskSocketIdForGate: jest.fn().mockReturnValue('sock-test-1'),
    };

    ttsAdapter = {
      synthesize: jest.fn().mockResolvedValue(Buffer.from('fake-tts-audio')),
    };

    sttAdapter = {
      transcribe: jest.fn().mockResolvedValue('واتساب'),
    };

    nluAdapter = new NluRulesAdapter();

    const mockSessionService = {
      createSession: jest.fn().mockImplementation(async (dto: any) => {
        const session: KioskSession = {
          sessionId: 'session-123',
          gateId: dto.gateId,
          plateNo: dto.plateNo,
          customerName: dto.customerName,
          phone: dto.phone,
          currentState: dto.currentState || KioskStateEnum.IDLE,
          confirmationRetries: dto.confirmationRetries ?? 0,
          phoneRetries: dto.phoneRetries ?? 0,
          contactMethodRetries: dto.contactMethodRetries ?? 0,
          contactMethod: dto.contactMethod ?? null,
          socketId: dto.socketId ?? null,
          IsToyotaCustomer:dto.IsToyotaCustomer??null
        };

        sessions.set(session.sessionId, session);

        return session;
      }),

      getSession: jest.fn().mockImplementation(async (id: string) => {
        return sessions.get(id) || null;
      }),

      updateSession: jest.fn().mockImplementation(async (id: string, partial: any) => {
        const session = sessions.get(id);

        if (!session) {
          throw new Error('Session not found');
        }

        const updated = {
          ...session,
          ...partial,
        };

        sessions.set(id, updated);

        return updated;
      }),

      transitionState: jest
        .fn()
        .mockImplementation(async (id: string, expected: string, next: string) => {
          const session = sessions.get(id);

          if (!session) {
            return {
              status: 'SESSION_NOT_FOUND',
              session: null,
            };
          }

          if (session.currentState !== expected) {
            return {
              status: 'STATE_MISMATCH',
              currentState: session.currentState,
              session: null,
            };
          }

          session.currentState = next;

          sessions.set(id, session);

          return {
            status: 'SUCCESS',
            session,
          };
        }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KioskService,

        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, def: any) => {
              if (key === 'ACTIVE_APPROACH') {
                return 'voice';
              }

              return def;
            }),
          },
        },

        {
          provide: SessionService,
          useValue: mockSessionService,
        },

        {
          provide: CheckInService,
          useValue: checkInService,
        },

        {
          provide: KioskGateway,
          useValue: kioskGateway,
        },

        {
          provide: TTS_ADAPTER_TOKEN,
          useValue: ttsAdapter,
        },

        {
          provide: STT_ADAPTER_TOKEN,
          useValue: sttAdapter,
        },

        {
          provide: NLU_ADAPTER_TOKEN,
          useValue: nluAdapter,
        },

        {
          provide: GateService,
          useValue: {
            openGate: jest.fn().mockResolvedValue(true),
          },
        },

        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<KioskService>(KioskService);
  });

  it('full voice path: phone confirmed -> prompt contact method -> parsed -> submitted with correct method', async () => {
    // 1. Initialize session via SAP lookup
    await service.handleSapLookupResult({
      gateId: 'gate-1',
      plate: '123-ABC',
      found: true,
      profile: {
        name: 'أحمد',
        phone: '01012345678',
      },
    });

    const session = sessions.get('session-123')!;

    expect(session.currentState).toBe(KioskStateEnum.CONFIRMING_PHONE);

    expect(session.contactMethod).toBeNull();

    expect(session.contactMethodRetries).toBe(0);

    // 2. Customer confirms phone number with YES
    await service.handleInput({
      sessionId: 'session-123',
      gateId: 'gate-1',
      state: KioskStateEnum.CONFIRMING_PHONE,
      text: 'أيوه صح',
    });

    // Verify state transitioned to CONTACT_METHOD_ASKING and voice prompt was sent
    expect(sessions.get('session-123')!.currentState).toBe(KioskStateEnum.CONTACT_METHOD_ASKING);

    expect(checkInService.submit).not.toHaveBeenCalled();

    expect(kioskGateway.sendOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-123',
        state: KioskStateEnum.CONTACT_METHOD_ASKING,
        inputMode: inputModeEnum.VOICE,
      }),
    );

    // 3. Customer answers with WhatsApp via audio
    sttAdapter.transcribe.mockResolvedValueOnce('واتساب');

    await service.handleInput({
      sessionId: 'session-123',
      gateId: 'gate-1',
      state: KioskStateEnum.CONTACT_METHOD_ASKING,
      audio: Buffer.from('mock-audio-whatsapp'),
    });

    // Verify session updated and check-in submitted with WHATSAPP
    expect(sessions.get('session-123')!.contactMethod).toBe('WHATSAPP');

    expect(checkInService.submit).toHaveBeenCalledTimes(1);

    expect(checkInService.submit).toHaveBeenCalledWith({
      gateId: 'gate-1',
      plate: '123-ABC',
      name: 'أحمد',
      phone: '01012345678',
      source: 'VOICE',
      preferredContactMethod: 'WHATSAPP',
    });
  });

  it('handles retry: first attempt UNKNOWN re-prompts, second attempt succeeds with SMS', async () => {
    // 1. Initialize session in CONTACT_METHOD_ASKING state
    const session: KioskSession = {
      sessionId: 'session-retry',
      gateId: 'gate-2',
      plateNo: '456-XYZ',
      customerName: 'محمد',
      phone: '01298765432',
      currentState: KioskStateEnum.CONTACT_METHOD_ASKING,
      confirmationRetries: 0,
      phoneRetries: 0,
      contactMethodRetries: 0,
      contactMethod: null,
      IsToyotaCustomer:true
    };

    sessions.set(session.sessionId, session);

    // 2. First attempt: unrecognized speech
    await service.handleInput({
      sessionId: 'session-retry',
      gateId: 'gate-2',
      state: KioskStateEnum.CONTACT_METHOD_ASKING,
      text: 'مش فاهم قصدك ايه',
    });

    // Check-in must NOT be submitted
    expect(checkInService.submit).not.toHaveBeenCalled();

    // Session retries incremented to 1
    const sessionAfterFirst = sessions.get('session-retry')!;

    expect(sessionAfterFirst.contactMethodRetries).toBe(1);

    expect(sessionAfterFirst.contactMethod).toBeNull();

    // Re-prompted with VOICE mode
    expect(kioskGateway.sendOutput).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sessionId: 'session-retry',
        state: KioskStateEnum.CONTACT_METHOD_ASKING,
        inputMode: inputModeEnum.VOICE,
      }),
    );

    // 3. Second attempt: valid method
    await service.handleInput({
      sessionId: 'session-retry',
      gateId: 'gate-2',
      state: KioskStateEnum.CONTACT_METHOD_ASKING,
      text: 'رسالة نصية',
    });

    // Check-in submitted with SMS
    expect(checkInService.submit).toHaveBeenCalledTimes(1);

    expect(checkInService.submit).toHaveBeenCalledWith({
      gateId: 'gate-2',
      plate: '456-XYZ',
      name: 'محمد',
      phone: '01298765432',
      source: 'VOICE',
      preferredContactMethod: 'SMS',
    });

    const sessionAfterSecond = sessions.get('session-retry')!;

    expect(sessionAfterSecond.contactMethod).toBe('SMS');
  });

  it('falls back to selection buttons when retry ceiling is exceeded', async () => {
    // Session with contactMethodRetries already at 1
    const session: KioskSession = {
      sessionId: 'session-fallback',
      gateId: 'gate-3',
      plateNo: '789-DEF',
      customerName: 'سارة',
      phone: '01122334455',
      currentState: KioskStateEnum.CONTACT_METHOD_ASKING,
      confirmationRetries: 0,
      phoneRetries: 0,
      contactMethodRetries: 1,
      contactMethod: null,
      IsToyotaCustomer:false
    };

    sessions.set(session.sessionId, session);

    // Second unrecognized utterance
    await service.handleInput({
      sessionId: 'session-fallback',
      gateId: 'gate-3',
      state: KioskStateEnum.CONTACT_METHOD_ASKING,
      text: 'كلام غير مفهوم تماما',
    });

    // Must NOT submit check-in or pick a default method
    expect(checkInService.submit).not.toHaveBeenCalled();

    const updated = sessions.get('session-fallback')!;

    expect(updated.contactMethod).toBeNull();

    // Must show buttons on frontend
    expect(kioskGateway.sendOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-fallback',
        state: KioskStateEnum.CONTACT_METHOD_ASKING,
        inputMode: inputModeEnum.BUTTONS,
        message: 'من فضلك اختر طريقة التواصل',
      }),
    );
  });
});
