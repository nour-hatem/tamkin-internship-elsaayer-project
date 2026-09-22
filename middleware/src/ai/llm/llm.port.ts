export interface ILlmAdapter {
  generateResponse(prompt: string, context?: Record<string, any>): Promise<string>;
}
export const LLM_ADAPTER_TOKEN = 'LLM_ADAPTER_TOKEN';
