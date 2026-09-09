import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GateService } from './gate.service';
import { GATE_ADAPTER_TOKEN } from './ports/gate.port';
import { StubGateAdapter } from './adapters/stub-gate.adapter';

@Module({
  providers: [
    GateService,
    {
      provide: GATE_ADAPTER_TOKEN,
      useFactory: (configService: ConfigService) => {
        const adapter = configService.get<string>('GATE_ADAPTER', 'stub');
        if (adapter === 'stub') {
          return new StubGateAdapter();
        }
        return new StubGateAdapter();
      },
      inject: [ConfigService],
    },
  ],
  exports: [GateService],
})
export class GateModule {}
