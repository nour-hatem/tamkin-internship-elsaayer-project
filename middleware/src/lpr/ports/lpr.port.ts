import { PlateReadDto } from '../../common/dtos/plate-read.dto';

export interface ILprAdapter {
  readPlate(plateNo: string, gateId: string): Promise<PlateReadDto>;
}

export const LPR_ADAPTER_TOKEN = 'LPR_ADAPTER_TOKEN';
