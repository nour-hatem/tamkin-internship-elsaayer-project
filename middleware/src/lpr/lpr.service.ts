import { Inject, Injectable, Logger } from '@nestjs/common';
import { LPR_ADAPTER_TOKEN, ILprAdapter } from './ports/lpr.port';
import { TypedEventEmitter } from '../common/typed-event-emitter.service';
import { EVENTS } from '../common/events';
import { PlateReadDto } from '../common/dtos/plate-read.dto';

@Injectable()
export class LprService {
  private readonly logger = new Logger(LprService.name);

  constructor(
    @Inject(LPR_ADAPTER_TOKEN) private readonly lprAdapter: ILprAdapter,
    private readonly eventEmitter: TypedEventEmitter,
  ) {}

  async readFromLpr(plateNo: string, gateId: string): Promise<PlateReadDto> {
    this.logger.log(`Triggering LPR read for plate: ${plateNo}, gate: ${gateId}`);
    const dto = await this.lprAdapter.readPlate(plateNo, gateId);
    this.eventEmitter.emit(EVENTS.PLATE_READ, dto);
    return dto;
  }
}
