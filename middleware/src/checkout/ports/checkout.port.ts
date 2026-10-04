export const CHECKOUT_ADAPTER_TOKEN = 'CHECKOUT_ADAPTER_TOKEN';

export interface ICheckoutAdapter {
  checkout(ticketId: string): Promise<void>;
}