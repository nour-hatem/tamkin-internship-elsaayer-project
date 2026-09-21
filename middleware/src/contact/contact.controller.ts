import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { ContactService } from './contact.service';

export class AcknowledgeDto {
  ticketId: string;
  slotId:string
}

@Controller('queue')
export class ContactController {
  constructor(
    private readonly contactService: ContactService,
  ) {}

  @Post('acknowledge')
  acknowledge(@Body() dto: AcknowledgeDto) {
    return this.contactService.acknowledge(
      dto.ticketId,dto.slotId
    );
  }
}