import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SAP_ADAPTER_TOKEN, ISapAdapter } from './ports/sap.port';
import { EVENTS } from '../common/events';
import { PlateReadDto } from '../common/dtos/plate-read.dto';
import { SapLookupResultDto } from '../common/dtos/sap-lookup-result.dto';
import { TypedEventEmitter } from '../common/typed-event-emitter.service';

@Injectable()
export class SapService {
  private readonly logger = new Logger(SapService.name);

  constructor(
    @Inject(SAP_ADAPTER_TOKEN) private readonly sapAdapter: ISapAdapter,
    private readonly eventEmitter: TypedEventEmitter,
  ) {}

  @OnEvent(EVENTS.PLATE_READ)
  async handlePlateRead(payload: PlateReadDto): Promise<SapLookupResultDto> {
    this.logger.log(`PLATE_READ payload: ${JSON.stringify(payload)}`);

    this.logger.log(`Handling PLATE_READ event for plate: ${payload.plateNo}, gate: ${payload.gateId}`);
    const result = await this.sapAdapter.lookupByPlate(payload.plateNo);

    const lookupResultWithGate: SapLookupResultDto = {
      ...result,
      gateId: payload.gateId,
    };

    this.logger.log(`SAP Lookup completed. Found: ${result.found}, gateId: ${payload.gateId}`);
    this.eventEmitter.emit(EVENTS.SAP_LOOKUP_RESULT, lookupResultWithGate);
    return lookupResultWithGate;
  }
}
