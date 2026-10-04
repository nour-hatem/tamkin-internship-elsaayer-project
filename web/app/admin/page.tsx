"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import StatCard from "@/components/admin/StatCard";
import type { Gate, QueueTicket } from "@/types/admin";

import {
  joinAdminGateRoom,
  subscribeToGateConnected,
  subscribeToGateDisconnected,
  subscribeToQueueTicketAdded,
  subscribeToQueueTicketStatusUpdated,
} from "../../lib/socket";

const API_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

interface QueueResponse {
  tickets: QueueTicket[];
}

function upsertTicket(
  tickets: QueueTicket[],
  incoming: QueueTicket
): QueueTicket[] {
  const index = tickets.findIndex(
    (ticket) => ticket.ticketId === incoming.ticketId
  );

  if (index === -1) {
    return [incoming, ...tickets];
  }

  const updated = [...tickets];
  updated[index] = incoming;

  return updated;
}

export default function AdminDashboard() {
  const [gates, setGates] = useState<Gate[]>([]);
  const [tickets, setTickets] = useState<QueueTicket[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchDashboardData(showLoading = true) {
      try {
        if (showLoading) {
          setLoading(true);
        }

        setError(null);

        const [gatesResponse, queueResponse] = await Promise.all([
          fetch(`${API_URL}/admin/gates`),
          fetch(`${API_URL}/admin/queue`),
        ]);

        if (!gatesResponse.ok || !queueResponse.ok) {
          throw new Error("Failed to fetch dashboard data");
        }

        const gatesData = await gatesResponse.json();
        const queueData: QueueResponse = await queueResponse.json();

        if (!mounted) {
          return;
        }

        const gatesList: Gate[] = Array.isArray(gatesData)
          ? gatesData
          : gatesData.gates || [];

        const ticketsList = queueData.tickets ?? [];

        setGates(gatesList);
        setTickets(ticketsList);

        /*
         * Join rooms for currently connected gates.
         */
        gatesList.forEach((gate) => {
          const gateId =  gate.id;

          if (gateId) {
            joinAdminGateRoom(gateId);
          }
        });

        /*
         * Also join rooms represented by existing tickets.
         *
         * A gate may not currently be connected,
         * but its tickets can still exist in the queue.
         */
        ticketsList.forEach((ticket) => {
          if (ticket.gateId) {
            joinAdminGateRoom(ticket.gateId);
          }
        });
      } catch (err) {
        if (!mounted) {
          return;
        }

        console.error(err);

        setError("Unable to load dashboard data.");
      } finally {
        if (mounted && showLoading) {
          setLoading(false);
        }
      }
    }

    /*
     * Initial dashboard data.
     */
    fetchDashboardData();

    /*
     * Gate connected
     *
     * Re-fetch so the dashboard gets the complete
     * Gate object after a gate connects.
     */
    const unsubscribeConnected = subscribeToGateConnected(() => {
      fetchDashboardData(false);
    });

    /*
     * Gate disconnected
     *
     * Remove the disconnected gate immediately.
     */
    const unsubscribeDisconnected = subscribeToGateDisconnected(
      (payload) => {
        setGates((previous) =>
          previous.filter((gate) => gate.id !== payload.gateId)
        );
      }
    );

    /*
     * New queue ticket
     *
     * Add the ticket immediately and make sure
     * we are subscribed to its gate room.
     */
    const unsubscribeTicketAdded =
      subscribeToQueueTicketAdded(({ ticket }) => {
        if (!ticket) {
          return;
        }

        /*
         * Join the gate room associated with this ticket.
         */
        if (ticket.gateId) {
          joinAdminGateRoom(ticket.gateId);
        }

        /*
         * Update tickets.
         *
         * The dashboard counters are calculated from
         * this state, so they update automatically.
         */
        setTickets((previous) =>
          upsertTicket(previous, ticket)
        );
      });

    /*
     * Queue ticket status updated
     *
     * Example:
     *
     * WAITING -> CALLED
     *
     * The ticket state changes and React automatically
     * recalculates the dashboard statistics.
     */
    const unsubscribeTicketStatusUpdated =
      subscribeToQueueTicketStatusUpdated(
        ({ ticketId, status }) => {
          if (!ticketId || !status) {
            return;
          }

          setTickets((previous) =>
            previous.map((ticket) =>
              ticket.ticketId === ticketId
                ? {
                    ...ticket,
                    status: status as QueueTicket["status"],
                  }
                : ticket
            )
          );
        }
      );

    return () => {
      mounted = false;

      unsubscribeConnected();
      unsubscribeDisconnected();

      unsubscribeTicketAdded();
      unsubscribeTicketStatusUpdated();
    };
  }, []);

  /*
   * Queue statistics
   *
   * These are calculated directly from the current
   * real-time tickets state.
   */
  const totalTickets = tickets.length;

  const waitingCustomers = tickets.filter(
    (ticket) => ticket.status === "WAITING"
  ).length;

  const calledCustomers = tickets.filter(
    (ticket) => ticket.status === "CALLED"
  ).length;

  const inService = tickets.filter(
    (ticket) => ticket.status === "IN_SERVICE"
  ).length;

  const noShowCustomers = tickets.filter(
    (ticket) =>
      ticket.status === "NO_SHOW" ||
      ticket.status === "SKIPPED"
  ).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Dashboard
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Overview of the Toyota Smart Gate system.
        </p>
      </div>

      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-500">
            Loading dashboard...
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
        <>
          {/* Queue Statistics */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              title="Total Tickets"
              value={totalTickets}
            />

            <StatCard
              title="Waiting"
              value={waitingCustomers}
            />

            <StatCard
              title="Called"
              value={calledCustomers}
            />

            <StatCard
              title="In Service"
              value={inService}
            />

            <StatCard
              title="No Shows"
              value={noShowCustomers}
            />
          </div>

          {/* Connected Gates */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Connected Gates
                </h2>

                <p className="text-sm text-gray-500">
                  Monitor the current status of all gates.
                </p>
              </div>

              <Link
                href="/admin/gates"
                className="text-sm font-medium text-red-600 hover:text-red-700"
              >
                View all
              </Link>
            </div>

            {gates.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
                <p className="text-lg font-medium text-gray-900">
                  No gates currently connected
                </p>

                <p className="mt-2 text-sm text-gray-500">
                  Gates appear here automatically when a kiosk
                  socket joins a gate room.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {gates.map((gate) => {
                  const gateId = gate.gateId || gate.id;

                  const waitingCount = tickets.filter(
                    (ticket) =>
                      ticket.gateId === gateId &&
                      ticket.status === "WAITING"
                  ).length;

                  return (
                    <Link
                      key={gateId}
                      href={`/admin/gates/${gateId}`}
                      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md"
                    >
                      <div>
                        <h3 className="font-semibold">
                          {gate.name}
                        </h3>

                        <p className="mt-1 text-sm text-gray-500">
                          {gate.location}
                        </p>
                      </div>

                      <div className="mt-5">
                        <p className="text-sm text-gray-500">
                          Waiting
                        </p>

                        <p className="text-2xl font-semibold">
                          {waitingCount}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}