import { Controller, Get, Param } from '@nestjs/common';
import { QrService } from './qr.service';

@Controller('qr')
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @Get('ticket/:id')
  async getTicketStatus(@Param('id') ticketId: string) {
    return {
      ticketId,
      status: 'ACTIVE',
      message: 'Rahma QR Ticket placeholder endpoint',
    };
  }
}
