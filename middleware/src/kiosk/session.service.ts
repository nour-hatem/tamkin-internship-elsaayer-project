import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SessionRepository } from './session.repository';
import { KioskSession, CreateSessionDto } from './interfaces/kiosk-session.interface';
import { KioskStateEnum } from './enum/VoiceStateEnum';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(private readonly sessionRepository: SessionRepository) {}

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

    await this.sessionRepository.save(session);
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
    await this.sessionRepository.save(session);
    this.logger.log(`Updated session ${sessionId} state to ${newState}`);
    return session;
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

    await this.sessionRepository.save(updatedSession);
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
