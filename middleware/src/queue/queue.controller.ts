import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';
import { QueueService } from './queue.service';

class SimulateSlotDto {
  @IsString()
  @IsNotEmpty()
  slotId: string;

  @IsString()
  @IsNotEmpty()
  gateId: string;
}

class SimulateAckDto {
  @IsString()
  @IsNotEmpty()
  slotId: string;

  @IsBoolean()
  acknowledged: boolean;
}

@Controller('queue')
export class QueueController {
  private readonly logger = new Logger(QueueController.name);

  constructor(private readonly queueService: QueueService) {}

  @Get('tickets')
  async getTickets() {
    return this.queueService.getAllTickets();
  }

  @Get('slots')
  async getSlots() {
    return this.queueService.getAllSlots();
  }

  @Post('simulate-slot')
  async simulateSlot(@Body() dto: SimulateSlotDto) {
    return this.queueService.simulateSlotAvailable(dto.slotId, dto.gateId);
  }

  @Post('simulate-ack')
  async simulateAck(@Body() dto: SimulateAckDto) {
    this.logger.log(`[simulate-ack] Body: ${JSON.stringify(dto)}`);

    this.logger.log(
      `[simulate-ack] slotId=${dto.slotId}, acknowledged=${dto.acknowledged}, type=${typeof dto.acknowledged}`,
    );

    return this.queueService.simulateAck(dto.slotId, dto.acknowledged);
  }
}



