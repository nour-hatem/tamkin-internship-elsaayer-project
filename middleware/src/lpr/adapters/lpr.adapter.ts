import { Injectable, Logger } from '@nestjs/common';
import { ILprAdapter } from '../ports/lpr.port';
import { PlateReadDto } from '../../common/dtos/plate-read.dto';

@Injectable()
export class LprAdapter implements ILprAdapter {
  private readonly logger = new Logger(LprAdapter.name);

  async readPlate(plateNo: string, gateId: string): Promise<PlateReadDto> {
    this.logger.log(`[Stub LPR] Reading plate "${plateNo}" at gate "${gateId}"`);
    return {
      plateNo,
      gateId,
      timestamp: new Date().toISOString(),
    };
  }
}
