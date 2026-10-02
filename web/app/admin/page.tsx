"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import StatCard from "@/components/admin/StatCard";
import type { Gate, QueueTicket } from "@/types/admin";
import {
  subscribeToGateConnected,
  subscribeToGateDisconnected,
} from "../../lib/socket";

const API_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

interface QueueResponse {
  tickets: QueueTicket[];
}

export default function AdminDashboard() {
  const [gates, setGates] = useState<Gate[]>([]);
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

    const gatesList: Gate[] = Array.isArray(gatesData)
      ? gatesData
      : gatesData.gates || [];

    setGates(gatesList);
    setTickets(queueData.tickets);
  } catch (err) {
    console.error(err);
    setError("Unable to load dashboard data.");
  } finally {
    if (showLoading) {
      setLoading(false);
    }
  }
}

    fetchDashboardData();

    const unsubscribeConnected = subscribeToGateConnected(() => {
      // Re-fetch so the dashboard keeps the complete Gate object
      // (id, name, location, etc.) after a gate connects.
      fetchDashboardData(false);
    });

    const unsubscribeDisconnected = subscribeToGateDisconnected((payload) => {
      // Remove the disconnected gate immediately.
      setGates((prev) =>
        prev.filter((gate) => gate.id !== payload.gateId)
      );
    });

    return () => {
      unsubscribeConnected();
      unsubscribeDisconnected();
    };
  }, []);

  const waitingCustomers = tickets.filter(
    (ticket) => ticket.status === "WAITING"
  ).length;

  const calledCustomers = tickets.filter(
    (ticket) => ticket.status === "CALLED"
  ).length;

  const inService = tickets.filter(
    (ticket) => ticket.status === "IN_SERVICE"
  ).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

        <p className="mt-1 text-sm text-gray-500">
          Overview of the Toyota Smart Gate system.
        </p>
      </div>

      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-500">Loading dashboard...</p>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              title="Waiting Customers"
              value={waitingCustomers}
            />

            <StatCard
              title="Called Customers"
              value={calledCustomers}
            />

            <StatCard
              title="Currently In Service"
              value={inService}
            />
          </div>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Connected Gates</h2>

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
                  Gates appear here automatically when a kiosk socket joins a
                  gate room.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {gates.map((gate) => {
                  const waitingCount = tickets.filter(
                    (ticket) =>
                      ticket.gateId === gate.id &&
                      ticket.status === "WAITING"
                  ).length;

                  return (
                    <Link
                      key={gate.id}
                      href={`/admin/gates/${gate.id}`}
                      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md"
                    >
                      <div>
                        <h3 className="font-semibold">{gate.name}</h3>

                        <p className="mt-1 text-sm text-gray-500">
                          {gate.location}
                        </p>
                      </div>

                      <div className="mt-5">
                        <p className="text-sm text-gray-500">Waiting</p>

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
