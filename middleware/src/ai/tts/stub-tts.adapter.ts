import { Injectable, Logger } from '@nestjs/common';
import { ITtsAdapter } from './tts.port';

@Injectable()
export class StubTtsAdapter implements ITtsAdapter {
  private readonly logger = new Logger(StubTtsAdapter.name);

  async synthesize(text: string): Promise<Buffer> {
    this.logger.log(`[Stub TTS] Synthesizing speech for: "${text}"`);
    return Buffer.from('mock-audio-bytes');
  }
}
