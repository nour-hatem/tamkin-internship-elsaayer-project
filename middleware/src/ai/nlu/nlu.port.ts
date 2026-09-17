import { NluResultDto } from '../../common/dtos/nlu-result.dto';


export interface INluAdapter {
  parse(text: string): Promise<NluResultDto>;
}
export const NLU_ADAPTER_TOKEN = process.env.NLU_ADAPTER;
