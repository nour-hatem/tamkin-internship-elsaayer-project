import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { CheckInService } from '../checkin/checkin.service';
import { EVENTS } from '../common/events';
import { SapLookupResultDto } from '../common/dtos/sap-lookup-result.dto';

@Injectable()
export class QrService {
  private readonly logger = new Logger(QrService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly checkInService: CheckInService,
  ) {}

  @OnEvent(EVENTS.SAP_LOOKUP_RESULT)
  async handleSapLookupResult(payload: SapLookupResultDto) {
    const activeApproach = this.configService.get<string>('ACTIVE_APPROACH', 'voice');
    if (activeApproach.toLowerCase() !== 'qr') {
      this.logger.debug(`[QrService] Ignoring SAP result for ${payload.plate} - active approach is '${activeApproach}'`);
      return;
    }

    this.logger.log(`[QrService] Processing active QR check-in for plate: ${payload.plate}`);
    
    // Auto submit or start QR session logic (Rahma's placeholder flow)
    await this.checkInService.submit({
      gateId: 'gate-1',
      plate: payload.plate,
      name: payload.profile?.name || 'QR Customer',
      phone: payload.profile?.phone || '+966500000000',
      source: 'QR',
    });
  }
}
