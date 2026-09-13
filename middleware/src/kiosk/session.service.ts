import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { SessionRepository, AtomicTransitionResult } from './session.repository';
import { KioskSession, CreateSessionDto } from './interfaces/kiosk-session.interface';
import { KioskStateEnum } from './enum/VoiceStateEnum';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly ttlSeconds: number;

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly configService: ConfigService,
  ) {
    const rawTtl = this.configService.get<string | number>('KIOSK_SESSION_TTL_SECONDS');
    const parsed = typeof rawTtl === 'number' ? rawTtl : Number(rawTtl);
    this.ttlSeconds = Number.isFinite(parsed) && parsed > 0 ? parsed : 180;
  }

  async createSession(dto: CreateSessionDto): Promise<KioskSession> {
    const sessionId = dto.sessionId || randomUUID();
    const initialState = dto.currentState || KioskStateEnum.IDLE;

    const session: KioskSession = {
      sessionId,
      gateId: dto.gateId,
      plateNo: dto.plateNo,
      customerName: dto.customerName,
      phone: dto.phone,
      currentState: initialState,
      phoneRetries: 0,
      confirmationRetries: 0,
      socketId: dto.socketId ?? null,
    };

    await this.sessionRepository.save(session, this.ttlSeconds);
    this.logger.log(
      `Created new session ${sessionId} for gate ${dto.gateId} with initial state ${initialState}`,
    );
    return session;
  }

  async getSession(sessionId: string): Promise<KioskSession | null> {
    return this.sessionRepository.findById(sessionId);
  }

  async getSessionByGate(gateId: string): Promise<KioskSession | null> {
    return this.sessionRepository.findByGateId(gateId);
  }

  async updateState(sessionId: string, newState: string): Promise<KioskSession> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    session.currentState = newState;
    await this.sessionRepository.save(session, this.ttlSeconds);
    this.logger.log(`Updated session ${sessionId} state to ${newState}`);
    return session;
  }

  async transitionState(
    sessionId: string,
    expectedState: string,
    newState: string,
  ): Promise<AtomicTransitionResult> {
    return this.sessionRepository.atomicTransitionState(
      sessionId,
      expectedState,
      newState,
    );
  }


  async updateSession(
    sessionId: string,
    partialSession: Partial<Omit<KioskSession, 'sessionId'>>,
  ): Promise<KioskSession> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    const updatedSession: KioskSession = {
      ...session,
      ...partialSession,
    };

    await this.sessionRepository.save(updatedSession, this.ttlSeconds);
    this.logger.log(`Updated session ${sessionId} data`);
    return updatedSession;
  }

  async endSession(sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findById(sessionId);
    if (session) {
      await this.sessionRepository.delete(sessionId, session.gateId);
      this.logger.log(`Ended session ${sessionId} for gate ${session.gateId}`);
    }
  }
}
