"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import CustomerTable from "@/components/admin/CustomerTable";
import { gateSocket } from "@/lib/gateSocket";
import type {
  QueueTicket,
  QueueTicketStatus,
} from "@/types/admin";

interface GateQueueResponse {
  gateId: string;
  tickets: QueueTicket[];
}

export default function GateCustomersPage() {
  const params = useParams();
  const gateId = params.gateId as string;

  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial customers data
  useEffect(() => {
    async function fetchCustomers() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/admin/gates/${gateId}/queue`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch customers");
        }

        const data: GateQueueResponse = await response.json();

        // Customers tab shows ALL tickets.
        setTickets(data.tickets);
      } catch (err) {
        console.error(err);
        setError("Unable to load customers.");
      } finally {
        setLoading(false);
      }
    }

    fetchCustomers();
  }, [gateId]);

  // Real-time customer updates
  useEffect(() => {
    if (!gateId) return;

    gateSocket.connect();

    gateSocket.emit("joinGate", { gateId });

    // New customer/ticket entered the queue
    const handleTicketAdded = (payload: {
      ticket: QueueTicket;
    }) => {
      const ticket = payload.ticket;

      // Make sure the ticket belongs to this gate
      if (ticket.gateId !== gateId) return;

      setTickets((current) => {
        // Prevent duplicates
        if (
          current.some(
            (item) => item.ticketId === ticket.ticketId,
          )
        ) {
          return current;
        }

        return [...current, ticket];
      });
    };

    // Existing customer's status changed
    const handleTicketStatusUpdated = (payload: {
      ticketId: string;
      status: QueueTicketStatus;
    }) => {
      setTickets((current) =>
        current.map((ticket) =>
          ticket.ticketId === payload.ticketId
            ? {
                ...ticket,
                status: payload.status,
              }
            : ticket,
        ),
      );
    };

    gateSocket.on(
      "QUEUE_TICKET_ADDED",
      handleTicketAdded,
    );

    gateSocket.on(
      "QUEUE_TICKET_STATUS_UPDATED",
      handleTicketStatusUpdated,
    );

    return () => {
      gateSocket.off(
        "QUEUE_TICKET_ADDED",
        handleTicketAdded,
      );

      gateSocket.off(
        "QUEUE_TICKET_STATUS_UPDATED",
        handleTicketStatusUpdated,
      );

      gateSocket.emit("leaveGate", { gateId });
      gateSocket.disconnect();
    };
  }, [gateId]);

  return (
    <div className="space-y-6">
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
            Customer monitoring
          </p>
        </div>
      </div>

      <div className="flex w-fit gap-1 rounded-lg bg-gray-100 p-1">
        <Link
          href={`/admin/gates/${gateId}/queue`}
          className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          Queue
        </Link>

        <Link
          href={`/admin/gates/${gateId}/customers`}
          className="rounded-md bg-white px-4 py-2 text-sm font-medium shadow-sm"
        >
          Customers
        </Link>
      </div>

      <div>
        <h2 className="text-lg font-semibold">
          Gate Customers
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          All customers associated with Gate {gateId}.
        </p>
      </div>

      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-500">
            Loading customers...
          </p>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">
            {error}
          </p>
        </div>
      )}

      {!loading && !error && (
        <CustomerTable tickets={tickets} />
      )}
    </div>
  );
}