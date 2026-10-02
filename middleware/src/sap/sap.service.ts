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
    this.logger.log(`[SAP] Started plate lookup for plate: ${payload.plateNo}, gate: ${payload.gateId}`, {
      plate: payload.plateNo,
      gateId: payload.gateId,
    });

    const result = await this.sapAdapter.lookupByPlate(payload.plateNo, payload.gateId);

    const lookupResultWithGate: SapLookupResultDto = {
      ...result,
      gateId: payload.gateId,
    };

    this.logger.log(
      `[SAP] Plate lookup completed for plate: ${payload.plateNo}, gate: ${payload.gateId}. Result: ${result.found ? 'found' : 'not found'}`,
      {
        plate: payload.plateNo,
        gateId: payload.gateId,
        found: result.found,
        customerName: result.profile?.name,
      },
    );
    this.eventEmitter.emit(EVENTS.SAP_LOOKUP_RESULT, lookupResultWithGate);
    return lookupResultWithGate;
  }
}
