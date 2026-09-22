import { IsNotEmpty,  IsString } from 'class-validator';

export class SimulateLprDto {
  @IsString()
  @IsNotEmpty()
  plateNo: string;

  @IsString()
  @IsNotEmpty()
  gateId: string;
}