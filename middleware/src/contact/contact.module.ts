import { Module } from '@nestjs/common';
import { ContactService } from './contact.service';
import { SmsAdapter } from './adapters/SMS.adapter';
import { whatsappAdapter } from './adapters/whatsapp.adapter';
import { ElsaayerAppAdapter } from './adapters/elsayerApp.adapter';
import { CallingAgentAdapter } from './adapters/callingAgent.adapter';
import { ContactController } from './contact.controller';


@Module({
  controllers: [
    ContactController,
  ],

  providers: [
    ContactService,

    SmsAdapter,
    whatsappAdapter,
    ElsaayerAppAdapter,
    CallingAgentAdapter,
  ],

  exports: [
    ContactService,
  ],
})
export class ContactModule {}