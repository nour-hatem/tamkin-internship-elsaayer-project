import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { ContactService } from './contact.service';
import { IsNotEmpty, IsString } from 'class-validator';

export class AcknowledgeDto {
  @IsString()
  @IsNotEmpty()
  ticketId: string;

  @IsString()
  @IsNotEmpty()
  slotId: string;
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