import { Module } from '@nestjs/common';
import { CheckInService } from './checkin.service';
import { CheckInController } from './checkin.controller';
import { QueueModule } from '../queue/queue.module';
import { GateModule } from '../gate/gate.module';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [QueueModule, GateModule, RedisModule],
  controllers: [CheckInController],
  providers: [CheckInService],
  exports: [CheckInService],
})
export class CheckInModule {}