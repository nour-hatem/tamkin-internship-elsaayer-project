import { Inject, Injectable, Logger } from '@nestjs/common';
import { GATE_ADAPTER_TOKEN, IGateAdapter } from './ports/gate.port';

@Injectable()
export class GateService {
  private readonly logger = new Logger(GateService.name);

  constructor(
    @Inject(GATE_ADAPTER_TOKEN) private readonly gateAdapter: IGateAdapter,
  ) {}

  async openGate(gateId: string): Promise<boolean> {
    this.logger.log(`Requesting gate open for gateId: ${gateId}`);
    return this.gateAdapter.openGate(gateId);
  }
}
