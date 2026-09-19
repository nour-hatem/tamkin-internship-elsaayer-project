import { Injectable, Logger } from '@nestjs/common';
import { INluAdapter } from './nlu.port';
import { NluResultDto } from '../../common/dtos/nlu-result.dto';

@Injectable()
export class StubNluAdapter implements INluAdapter {
  private readonly logger = new Logger(StubNluAdapter.name);

  async parse(text: string, _context?: string): Promise<NluResultDto> {
    this.logger.log(`[Stub NLU] Parsing text: "${text}"`);
    return {
      intent: 'confirm_checkin',
      confidence: 0.95,
      entities: { confirmation: true },
    };
  }
}
