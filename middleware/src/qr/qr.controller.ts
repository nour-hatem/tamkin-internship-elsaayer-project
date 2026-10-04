import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { QrService } from './qr.service';
import { QrCheckinDto } from './dto/qr-checkin.dto';

@Controller(['qr', 'checkin'])
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @Post('ticket')
  async createTicket(@Body() body: { gateId: string }) {
    return this.qrService.createTicket(body.gateId);
  }

  @Post('checkin')
  async checkIn(@Body() dto: QrCheckinDto) {
    return this.qrService.checkIn(dto);
  }

  @Get('ticket/:id')
  async getTicketStatus(@Param('id') ticketId: string) {
    return this.qrService.getTicketStatus(ticketId);
  }

  @Get('display/:gateId')
  async getDisplay(@Param('gateId') gateId: string) {
    this.qrService.notifyGateConnected(gateId);
    const token = await this.qrService.getCurrentTicket(gateId);

    if (!token) {
      return {
        gateId,
        mode: 'GENERIC',
        checkInUrl: null,
        plate: await this.qrService.getPlateHint(gateId),
        plateLocked: false,
        name: null,
        expiresAt: null,
      };
    }

    try {
      const ticket = await this.qrService.getTicketStatus(token);

      return {
        gateId: ticket.gateId,
        mode: ticket.source,
        checkInUrl: this.qrService.getPublicCheckInUrl(
          ticket.gateId,
          token,
        ),
        plate: ticket.plate ?? null,
        plateLocked: ticket.plateLocked,
        name: ticket.name ?? null,
        expiresAt: await this.qrService.getTicketExpiresAt(token),
      };
    } catch {
      return {
        gateId,
        checkInUrl: null,
        plate: await this.qrService.getPlateHint(gateId),
        plateLocked: false,
        name: null,
        expiresAt: null,
      };
    }
  }
}