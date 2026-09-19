import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
} from 'class-validator';
import { ContactMethod } from '../../common/dtos/checkin-request.dto';

export class QrCheckinDto {
  @IsUUID()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  plate: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsEnum([
    'SMS',
    'WHATSAPP',
    'ELSAAYER_APP',
    'CALLING_AGENT',
  ])
  preferredContactMethod: ContactMethod;
}