export interface IGateAdapter {
  openGate(gateId: string): Promise<boolean>;
  closeGate(gateId: string): Promise<boolean>;
}

export const GATE_ADAPTER_TOKEN = 'GATE_ADAPTER_TOKEN';