import { Injectable, Logger } from '@nestjs/common';
import { ILlmAdapter } from './llm.port';

@Injectable()
export class StubLlmAdapter implements ILlmAdapter {
  private readonly logger = new Logger(StubLlmAdapter.name);

  async generateResponse(prompt: string, context?: Record<string, any>): Promise<string> {
    this.logger.log(`[Stub LLM] Generating response for prompt: "${prompt}"`);
    const name = context?.name || 'Customer';
    return `Welcome ${name}! Your check-in is confirmed and the gate is opening now.`;
  }
}
