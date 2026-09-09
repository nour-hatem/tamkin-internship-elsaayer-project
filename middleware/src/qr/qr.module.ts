import { Module } from '@nestjs/common';
import { CheckInModule } from '../checkin/checkin.module';
import { RedisModule } from '../common/redis/redis.module';
import { QrController } from './qr.controller';
import { QrService } from './qr.service';
import { QrTicketRepository } from './repositories/qr-ticket.repository';
import { QrTokenService } from './qr-token.service';

@Module({
  imports: [CheckInModule, RedisModule],
  controllers: [QrController],
  providers: [QrService, QrTicketRepository, QrTokenService],
  exports: [QrService],
})
export class QrModule {}
