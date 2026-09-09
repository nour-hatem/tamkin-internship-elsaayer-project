import { SapLookupResultDto } from '../../common/dtos/sap-lookup-result.dto';

export interface ISapAdapter {
  lookupByPlate(plate: string): Promise<SapLookupResultDto>;
}

export const SAP_ADAPTER_TOKEN = 'SAP_ADAPTER_TOKEN';
