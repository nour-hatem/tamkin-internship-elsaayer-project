import { Module } from '@nestjs/common';
import { CheckInService } from './checkin.service';
import { CheckInController } from './checkin.controller';
import { QueueModule } from '../queue/queue.module';
import { GateModule } from '../gate/gate.module';

@Module({
  imports: [QueueModule, GateModule],
  controllers: [CheckInController],
  providers: [CheckInService],
  exports: [CheckInService],
})
export class CheckInModule {}
