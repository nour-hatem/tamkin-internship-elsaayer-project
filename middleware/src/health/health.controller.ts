import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  checkHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      config: {
        activeApproach: this.configService.get<string>('ACTIVE_APPROACH', 'voice'),
        adapters: {
          sap: this.configService.get<string>('SAP_ADAPTER', 'prisma'),
          lpr: this.configService.get<string>('LPR_ADAPTER', 'stub'),
          gate: this.configService.get<string>('GATE_ADAPTER', 'stub'),
          stt: this.configService.get<string>('STT_ADAPTER', 'stub'),
          tts: this.configService.get<string>('TTS_ADAPTER', 'stub'),
          nlu: this.configService.get<string>('NLU_ADAPTER', 'stub'),
          llm: this.configService.get<string>('LLM_ADAPTER', 'stub'),
        },
      },
    };
  }
}
