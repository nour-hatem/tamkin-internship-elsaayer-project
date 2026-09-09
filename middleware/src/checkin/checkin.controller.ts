import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CheckInService } from './checkin.service';
import { CheckInRequestDto } from '../common/dtos/checkin-request.dto';
import { CheckInResultDto } from '../common/dtos/checkin-result.dto';

@Controller('checkin')
export class CheckInController {
  constructor(private readonly checkInService: CheckInService) {}

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  async submit(@Body() dto: CheckInRequestDto): Promise<CheckInResultDto> {
    return this.checkInService.submit(dto);
  }
}
