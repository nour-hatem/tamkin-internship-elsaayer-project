import { Controller, Get, Param } from '@nestjs/common';
import { AdminService, GateInfo } from './admin.service';
import { QueueTicket } from 'src/queue/queue.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** GET /admin/gates — list all currently connected gates */
  @Get('gates')
  getConnectedGates(): { gates: GateInfo[] } {
    return { gates: this.adminService.getConnectedGates() };
  }

  /** GET /admin/gates/:gateId/queue — tickets in queue for a specific gate */
  @Get('gates/:gateId/queue')
  async getGateQueue(
    @Param('gateId') gateId: string,
  ): Promise<{ gateId: string; tickets: QueueTicket[] }> {
    const tickets = await this.adminService.getGateQueue(gateId);
    return { gateId, tickets };
  }

  /** GET /admin/queue — full queue across all gates */
  @Get('queue')
  async getFullQueue(): Promise<{ tickets: QueueTicket[] }> {
    const tickets = await this.adminService.getFullQueue();
    return { tickets };
  }

   @Get('config')
  async getConfig(){
    return {
  "strategy": process.env.QUEUE_ROTATION_STRATEGY,
  "maxCandidates": process.env.QUEUE_MAX_CANDIDATES,
  "contactTimeout": process.env.QUEUE_CONTACT_TIMEOUT,
  "retryAttempts": process.env.QUEUE_RETRY_ATTEMPTS,
  "contactMethod": process.env.QUEUE_CONTACT_METHOD
}
  }
}
