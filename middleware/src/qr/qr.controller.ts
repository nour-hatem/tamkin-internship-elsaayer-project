import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { QrService } from './qr.service';
import { QrCheckinDto } from './dto/qr-checkin.dto';

@Controller('qr')
export class QrController {
  constructor(private readonly qrService: QrService) {}
  @Post('ticket')
  async createTicket() {
    return this.qrService.createTicket();
  }

  @Post('checkin')
  async checkIn(@Body() dto: QrCheckinDto) {
    return this.qrService.checkIn(dto);
  }

  @Get('ticket/:id')
  async getTicketStatus(@Param('id') ticketId: string) {
    return this.qrService.getTicketStatus(ticketId);
  }
}
