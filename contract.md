
REST
//////////////////////

GET /admin/gates

Response:

{
  gates: {
    id: string;
    name: string;
    location: string;
  }[];
}

GET /admin/queue

Response:

{
  tickets: QueueTicket[];
}

GET /admin/gates/:gateId/queue

Response:

{
  gateId: string;
  tickets: QueueTicket[];
}

QueueTicket:

{
  ticketId: string;
  queueNumber: number;
  gateId: string;
  plate: string;
  name: string;
  phone: string;
  source: "QR" | "VOICE";
  preferredContactMethod: ContactMethod;
  IsToyotaCustomer: boolean;
  status:
    | "WAITING"
    | "CALLED"
    | "ACKNOWLEDGED"
    | "IN_SERVICE"
    | "COMPLETED"
    | "SKIPPED";
  createdAt: string;
}
Socket.IO

Namespace:

/gate

Rooms:

gate:{gateId}

Client → server:

joinGate
{ gateId: string }
leaveGate
{ gateId: string }

Server → client:

QUEUE_TICKET_ADDED
{ ticket: QueueTicket }
QUEUE_TICKET_STATUS_UPDATED
{
  ticketId: string;
  status: QueueTicketStatus;
}

Note: The Customers tab uses the same queue endpoint and socket events as Queue, but it does not filter tickets by status. The Queue tab only displays WAITING, CALLED, ACKNOWLEDGED, and IN_SERVICE.

Note:IsToyotaCustomer is a boolean. true = Toyota Customer, false = New Customer.