"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import QueueTable from "@/components/admin/QueueTable";
import CurrentCustomerCard from "@/components/admin/CurrentCustomerCard";
import { queueSocket } from "@/lib/gateSocket";

import type {
  QueueTicket,
  QueueTicketStatus,
} from "@/types/admin";

interface GateQueueResponse {
  gateId: string;
  tickets: QueueTicket[];
}

interface TicketAddedPayload {
  ticket: QueueTicket;
}

interface TicketStatusUpdatedPayload {
  ticketId: string;
  status: QueueTicketStatus;
}

const ALLOWED_STATUSES: QueueTicketStatus[] = [
  "WAITING",
  "CALLED",
  "ACKNOWLEDGED",
  "IN_SERVICE",
];

export default function GateQueuePage() {
  const params = useParams();
  const gateId = params.gateId as string;

  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /*
   * Initial queue
   */
  useEffect(() => {
    async function fetchQueue() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/gates/${gateId}/queue`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch queue");
        }

        const data: GateQueueResponse = await response.json();

        const filteredTickets = data.tickets.filter((ticket) =>
          ALLOWED_STATUSES.includes(ticket.status),
        );

        setTickets(filteredTickets);
      } catch (err) {
        console.error(err);
        setError("Unable to load the queue.");
      } finally {
        setLoading(false);
      }
    }

    fetchQueue();
  }, [gateId]);

  /*
   * Socket.IO
   */
  useEffect(() => {
    if (!gateId) return;

    const room = `gate:${gateId}`;

    queueSocket.connect();

    queueSocket.emit("joinGate", {
      gateId,
    });

    /*
     * New ticket
     */
    const handleTicketAdded = (
      payload: TicketAddedPayload,
    ) => {
      const ticket = payload.ticket;

      if (ticket.gateId !== gateId) {
        return;
      }

      if (!ALLOWED_STATUSES.includes(ticket.status)) {
        return;
      }

      setTickets((currentTickets) => {
        const alreadyExists = currentTickets.some(
          (item) => item.ticketId === ticket.ticketId,
        );

        if (alreadyExists) {
          return currentTickets;
        }

        return [...currentTickets, ticket];
      });
    };

    /*
     * Ticket status changed
     */
    const handleTicketStatusUpdated = (
      payload: TicketStatusUpdatedPayload,
    ) => {
      setTickets((currentTickets) =>
        currentTickets.map((ticket) =>
          ticket.ticketId === payload.ticketId
            ? {
                ...ticket,
                status: payload.status,
              }
            : ticket,
        ),
      );
    };

    queueSocket.on(
      "QUEUE_TICKET_ADDED",
      handleTicketAdded,
    );

    queueSocket.on(
      "QUEUE_TICKET_STATUS_UPDATED",
      handleTicketStatusUpdated,
    );

    return () => {
      queueSocket.off(
        "QUEUE_TICKET_ADDED",
        handleTicketAdded,
      );

      queueSocket.off(
        "QUEUE_TICKET_STATUS_UPDATED",
        handleTicketStatusUpdated,
      );

      queueSocket.emit("leaveGate", {
        gateId,
      });

      queueSocket.disconnect();
    };
  }, [gateId]);

  const currentTicket = tickets.find(
    (ticket) => ticket.status === "IN_SERVICE",
  );

  const queueTickets = tickets.filter((ticket) =>
    ALLOWED_STATUSES.includes(ticket.status),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/admin/gates"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Connected Gates
        </Link>

        <div className="mt-4">
          <h1 className="text-2xl font-bold">
            Gate {gateId}
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Queue monitoring
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex w-fit gap-1 rounded-lg bg-gray-100 p-1">
        <Link
          href={`/admin/gates/${gateId}/queue`}
          className="rounded-md bg-white px-4 py-2 text-sm font-medium shadow-sm"
        >
          Queue
        </Link>

        <Link
          href={`/admin/gates/${gateId}/customers`}
          className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          Customers
        </Link>
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-500">
            Loading queue...
          </p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">
            {error}
          </p>
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          <CurrentCustomerCard customer={undefined} />

          <QueueTable tickets={queueTickets} />
        </>
      )}
    </div>
  );
}