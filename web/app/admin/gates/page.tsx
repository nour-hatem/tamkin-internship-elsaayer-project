"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { Gate } from "@/types/admin";
import {
  subscribeToGateConnected,
  subscribeToGateDisconnected,
} from "@/lib/socket";

const API_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";

export default function ConnectedGatesPage() {
  const [gates, setGates] = useState<Gate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGates(showLoading = true) {
      try {
        if (showLoading) {
          setLoading(true);
        }

        setError(null);

        const response = await fetch(`${API_URL}/admin/gates`);

        if (!response.ok) {
          throw new Error("Failed to fetch gates");
        }

        const data = await response.json();

        const gatesList: Gate[] = Array.isArray(data)
          ? data
          : data.gates || [];

        setGates(gatesList);
      } catch (err) {
        console.error(err);
        setError("Unable to load connected gates.");
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    }

    // Initial load
    fetchGates();

    // Gate connected
    const unsubscribeConnected = subscribeToGateConnected(() => {
      fetchGates(false);
    });

    // Gate disconnected
    const unsubscribeDisconnected = subscribeToGateDisconnected(
      (payload) => {
        setGates((prev) =>
          prev.filter((gate) => gate.id !== payload.gateId)
        );
      }
    );

    return () => {
      unsubscribeConnected();
      unsubscribeDisconnected();
    };
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">
          Connected Gates
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Monitor and inspect each gate in the system.
        </p>
      </div>

      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
          Loading gates...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {gates.map((gate) => (
            <Link
              key={gate.id}
              href={`/admin/gates/${gate.id}`}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
            >
              <div>
                <h2 className="text-lg font-semibold">
                  {gate.name}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {gate.location}
                </p>
              </div>

              <div className="mt-6">
                <p className="text-xs text-gray-500">
                  Waiting Customers
                </p>

                <p className="mt-1 text-2xl font-semibold">
                  {gate.waitingCount ?? 0}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}