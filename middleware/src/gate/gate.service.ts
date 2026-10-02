import { Inject, Injectable, Logger } from '@nestjs/common';
import { GATE_ADAPTER_TOKEN, IGateAdapter } from './ports/gate.port';

@Injectable()
export class GateService {
  private readonly logger = new Logger(GateService.name);

  private readonly gateOpenDurationMs = 5000;

  private readonly closeTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  constructor(
    @Inject(GATE_ADAPTER_TOKEN) private readonly gateAdapter: IGateAdapter,
  ) {}

  async openGate(gateId: string): Promise<boolean> {
    this.logger.log(`[Gate] Requesting gate open command for gate: ${gateId}`, {
      gateId,
    });

    const opened = await this.gateAdapter.openGate(gateId);

    if (!opened) {
      this.logger.warn(`[Gate] Gate open command failed for gate: ${gateId}`, {
        gateId,
        success: false,
      });
      return false;
    }

    // Cancel any existing close timer for this gate.
    const existingTimer = this.closeTimers.get(gateId);

    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Automatically close the gate after 5 seconds.
    const closeTimer = setTimeout(() => {
      void this.closeGate(gateId);
      this.closeTimers.delete(gateId);
    }, this.gateOpenDurationMs);

    this.closeTimers.set(gateId, closeTimer);

    this.logger.log(
      `[Gate] Gate open command successful for gate: ${gateId}. Auto-close scheduled in 5 seconds.`,
      {
        gateId,
        success: true,
      },
    );

    return true;
  }

  async closeGate(gateId: string): Promise<boolean> {
    this.logger.log(`Requesting gate close for gateId: ${gateId}`);

    const existingTimer = this.closeTimers.get(gateId);

    if (existingTimer) {
      clearTimeout(existingTimer);
      this.closeTimers.delete(gateId);
    }

    const closed = await this.gateAdapter.closeGate(gateId);

    if (!closed) {
      this.logger.warn(`Gate failed to close for gateId: ${gateId}`);
      return false;
    }

    this.logger.log(`Gate ${gateId} closed successfully.`);

    return true;
  }
}