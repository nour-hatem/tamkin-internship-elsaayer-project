import { Injectable, Logger } from '@nestjs/common';
import { ISapAdapter } from '../ports/sap.port';
import { PrismaService } from '../prisma.service';
import { SapLookupResultDto } from '../../common/dtos/sap-lookup-result.dto';

@Injectable()
export class SapAdapter implements ISapAdapter {
  private readonly logger = new Logger(SapAdapter.name);

  constructor(private readonly prisma: PrismaService) {}

  async lookupByPlate(
     plate: string,
     gateId: string,
    ): Promise<SapLookupResultDto>  {
    this.logger.log(`[Prisma SAP Adapter] Looking up plate in DB: ${plate}`);
    try {
      const customer = await this.prisma.customerProfile.findUnique({
        where: { plate },
      });

      if (!customer) {
        return {
          plate,
          found: false,
        };
      }

      return {
        plate: customer.plate,
        found: true,
        gateId,
        profile: {
          name: customer.name,
          phone: customer.phone,
        },
      };
    } catch (error:any) {
      this.logger.error(`Error querying Prisma for plate ${plate}: ${error.message}`);
      return {
        plate,
        found: false,
      };
    }
  }
}
