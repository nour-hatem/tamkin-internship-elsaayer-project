import { Injectable, Logger } from '@nestjs/common';
import { IGateAdapter } from '../ports/gate.port';

@Injectable()
export class StubGateAdapter implements IGateAdapter {
  private readonly logger = new Logger(StubGateAdapter.name);

  async openGate(gateId: string): Promise<boolean> {
    this.logger.log(`========================================`);
    this.logger.log(`[GATE CONTROLLER] GATE OPENED for gateId: ${gateId}`);
    this.logger.log(`========================================`);
    return true;
  }

  async closeGate(gateId: string): Promise<boolean> {
    this.logger.log(`========================================`);
    this.logger.log(`[GATE CONTROLLER] GATE CLOSED for gateId: ${gateId}`);
    this.logger.log(`========================================`);
    return true;
  }
}