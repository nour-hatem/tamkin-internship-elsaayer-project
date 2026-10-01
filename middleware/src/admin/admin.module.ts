import { Module } from '@nestjs/common';
import { QueueModule } from 'src/queue/queue.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGateway } from './admin.gateway';

@Module({
  imports: [QueueModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGateway],
  exports: [AdminService],
})
export class AdminModule {}
