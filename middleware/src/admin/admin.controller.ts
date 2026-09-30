import { Controller, Get, Param } from '@nestjs/common';
import { AdminService, GateEntry } from './admin.service';
import { QueueTicket } from 'src/queue/queue.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** GET /admin/gates — list all currently connected gates */
  @Get('gates')
  getConnectedGates(): GateEntry[] {
    return this.adminService.getConnectedGates();
  }

  /** GET /admin/gates/:gateId — gate metadata + its queue tickets */
  @Get('gates/:gateId')
  async getGate(
    @Param('gateId') gateId: string,
  ): Promise<{ gate: GateEntry | null; queue: QueueTicket[] }> {
    const gate =
      this.adminService.getConnectedGates().find((g) => g.gateId === gateId) ??
      null;
    const queue = await this.adminService.getGateQueue(gateId);
    return { gate, queue };
  }

  /** GET /admin/queue — full queue across all gates */
  @Get('queue')
  async getFullQueue(): Promise<QueueTicket[]> {
    return this.adminService.getFullQueue();
  }
}
