import { Injectable, Logger } from '@nestjs/common';
import { ISttAdapter } from './stt.port';

@Injectable()
export class StubSttAdapter implements ISttAdapter {
  private readonly logger = new Logger(StubSttAdapter.name);

  async transcribe(_audioBuffer: Buffer): Promise<string> {
    this.logger.log('[Stub STT] Simulating transcription...');
    return 'Hello, I would like to check in for service.';
  }
}
