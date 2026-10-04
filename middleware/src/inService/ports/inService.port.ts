export interface IInServiceAdapter {
  startService(ticketId: string): Promise<void>;
}

export const INSERVICE_ADAPTER_TOKEN = 'INSERVICE_ADAPTER_TOKEN';