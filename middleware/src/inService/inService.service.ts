import { Inject, Injectable, Logger } from "@nestjs/common";
import { IInServiceAdapter, INSERVICE_ADAPTER_TOKEN } from "./ports/inService.port";
import { TypedEventEmitter } from "@common/typed-event-emitter.service";
import { OnEvent } from "@nestjs/event-emitter";
import { EVENTS } from "@common/events";


@Injectable()
export class InServiceService {
  private readonly logger = new Logger(InServiceService.name);

  constructor(
    @Inject(INSERVICE_ADAPTER_TOKEN) private readonly inServiceAdapter: IInServiceAdapter,
    private readonly eventEmitter: TypedEventEmitter,
  ) {}

  @OnEvent(EVENTS.TICKET_ACKNOWLEDGED)
async handleAcknowledged(payload: { ticketId: string }) {
  await this.inServiceAdapter.startService(payload.ticketId);
}


 
}
