// import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
// import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';
// import { QueueService } from './queue.service';

// class SimulateSlotDto {
//   @IsString()
//   @IsNotEmpty()
//   slotId: string;

//   @IsString()
//   @IsNotEmpty()
//   gateId: string;
// }

// class SimulateAckDto {
//   @IsString()
//   @IsNotEmpty()
//   slotId: string;

//   @IsBoolean()
//   acknowledged: boolean;
// }

// @Controller('queue')
// export class QueueController {
//   private readonly logger = new Logger(QueueController.name);

//   constructor(private readonly queueService: QueueService) {}

//   @Get('tickets')
//   async getTickets() {
//     return this.queueService.getAllTickets();
//   }

//   @Get('slots')
//   async getSlots() {
//     return this.queueService.getAllSlots();
//   }

//   @Post('simulate-slot')
//   async simulateSlot(@Body() dto: SimulateSlotDto) {
//     return this.queueService.simulateSlotAvailable(dto.slotId, dto.gateId);
//   }

//   @Post('simulate-ack')
//   async simulateAck(@Body() dto: SimulateAckDto) {
//     this.logger.log(`[simulate-ack] Body: ${JSON.stringify(dto)}`);

//     this.logger.log(
//       `[simulate-ack] slotId=${dto.slotId}, acknowledged=${dto.acknowledged}, type=${typeof dto.acknowledged}`,
//     );

//     return this.queueService.simulateAck(dto.slotId, dto.acknowledged);
//   }
// }

import { Controller, Get, Param } from '@nestjs/common';
import type { QueueTicket } from './queue.service';
import { ContactMethod } from '@common/enums/contactMethod.enum';

@Controller('admin/gates')
export class QueueController {
  @Get(':gateId/queue')
  getMockQueue(
    @Param('gateId') gateId: string,
  ): {
    gateId: string;
    tickets: QueueTicket[];
  } {
    return {
      gateId,
      tickets: [
        {
          ticketId: 'TICK-1001',
          queueNumber: 1,
          gateId,
          plate: 'ABC-123',
          name: 'Ahmed Ali',
          phone: '01012345678',
          source: 'VOICE',
          preferredContactMethod:"CALLING_AGENT",
          status: 'COMPLETED',
          createdAt: new Date(),
        },
        {
          ticketId: 'TICK-1002',
          queueNumber: 2,
          gateId,
          plate: 'XYZ-456',
          name: 'Sara Mohamed',
          phone: '01123456789',
          source: 'QR',
          preferredContactMethod: "SMS",
          status: 'CALLED',
          createdAt: new Date(),
        },
        {
          ticketId: 'TICK-1003',
          queueNumber: 3,
          gateId,
          plate: 'DEF-789',
          name: 'Omar Hassan',
          phone: '01234567890',
          source: 'VOICE',
          preferredContactMethod: "CALLING_AGENT",
          status: 'ACKNOWLEDGED',
          createdAt: new Date(),
        },
        {
          ticketId: 'TICK-1004',
          queueNumber: 4,
          gateId,
          plate: 'GHI-321',
          name: 'Youssef Ahmed',
          phone: '01512345678',
          source: 'QR',
          preferredContactMethod: "SMS",
          status: 'IN_SERVICE',
          createdAt: new Date(),
        },
      ],
    };
  }
}