import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { LprService } from './lpr.service';
import { PlateReadDto } from '../common/dtos/plate-read.dto';
import { SimulateLprDto } from './dto/simulateLprDto';




@Controller('lpr')
export class LprController {
  constructor(private readonly lprService: LprService) {}

  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  async simulate(@Body() body: SimulateLprDto): Promise<PlateReadDto> {
    const { plateNo, gateId } = body;
    return this.lprService.readFromLpr(plateNo , gateId );
  }
}
