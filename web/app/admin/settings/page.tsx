"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { gateSocket } from "@/lib/gateSocket";

const API_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";

type QueueSlotStatus = "AVAILABLE" | "OCCUPIED";

interface QueueSlot {
  slotId: string;
  gateId: string;
  status: QueueSlotStatus;
}

interface SlotStatusUpdatedPayload {
  status: QueueSlotStatus;
}

interface QueueRotationConfig {
  strategy: string;
  maxCandidates: number;
  contactTimeout: number;
  retryAttempts: number;
  contactMethod: string;
}

export default function GateSettingsPage() {
  const params = useParams();
  const gateId = params.gateId as string;

  const [freeSlots, setFreeSlots] = useState(0);
  const [occupiedSlots, setOccupiedSlots] = useState(0);

  const [loadingSlots, setLoadingSlots] = useState(true);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const [rotationConfig, setRotationConfig] =
    useState<QueueRotationConfig | null>(null);

  const [loadingConfig, setLoadingConfig] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSlots() {
      try {
        setLoadingSlots(true);
        setSlotsError(null);

        const response = await fetch(`${API_URL}/queue/slots`);

        if (!response.ok) {
          throw new Error("Failed to fetch slots");
        }

        const slots: QueueSlot[] = await response.json();

        const free = slots.filter(
          (slot) => slot.status === "AVAILABLE"
        ).length;

        const occupied = slots.filter(
          (slot) => slot.status === "OCCUPIED"
        ).length;

        setFreeSlots(free);
        setOccupiedSlots(occupied);
      } catch (error) {
        console.error(error);
        setSlotsError("Unable to load slot information.");
      } finally {
        setLoadingSlots(false);
      }
    }

    fetchSlots();
  }, []);

  useEffect(() => {
    async function fetchRotationConfig() {
      try {
        setLoadingConfig(true);
        setConfigError(null);

        const response = await fetch(`${API_URL}/queue/config`);

        if (!response.ok) {
          throw new Error("Failed to fetch queue rotation configuration");
        }

        const config: QueueRotationConfig = await response.json();

        setRotationConfig(config);
      } catch (error) {
        console.error(error);
        setConfigError(
          "Unable to load queue rotation configuration."
        );
      } finally {
        setLoadingConfig(false);
      }
    }

    fetchRotationConfig();
  }, []);

  useEffect(() => {
    const handleConnect = () => {
      console.log("Settings socket connected:", gateSocket.id);
    };

    const handleConnectError = (error: Error) => {
      console.error(
        "Settings socket connection error:",
        error
      );
    };

    const handleSlotStatusUpdated = (
      payload: SlotStatusUpdatedPayload
    ) => {
      console.log("Slot status updated:", payload.status);

      if (payload.status === "OCCUPIED") {
        setFreeSlots((current) => Math.max(0, current - 1));
        setOccupiedSlots((current) => current + 1);
      }

      if (payload.status === "AVAILABLE") {
        setFreeSlots((current) => current + 1);
        setOccupiedSlots((current) =>
          Math.max(0, current - 1)
        );
      }
    };

    gateSocket.on("connect", handleConnect);
    gateSocket.on("connect_error", handleConnectError);
    gateSocket.on(
      "SLOT_STATUS_UPDATED",
      handleSlotStatusUpdated
    );

    gateSocket.connect();

    return () => {
      gateSocket.off("connect", handleConnect);
      gateSocket.off("connect_error", handleConnectError);
      gateSocket.off(
        "SLOT_STATUS_UPDATED",
        handleSlotStatusUpdated
      );

      gateSocket.disconnect();
    };
  }, []);

  const totalSlots = freeSlots + occupiedSlots;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Gate Settings
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          View slot availability and queue rotation configuration
          for Gate {gateId}.
        </p>
      </div>

      {/* Slot Availability */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Slot Availability
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Current availability of the shared service slots.
          </p>
        </div>

        {loadingSlots && (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <p className="text-sm text-gray-500">
              Loading slot information...
            </p>
          </div>
        )}

        {!loadingSlots && slotsError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <p className="text-sm text-red-700">
              {slotsError}
            </p>
          </div>
        )}

        {!loadingSlots && !slotsError && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Total Slots */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">
                  Total Slots
                </p>

                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  {totalSlots}
                </p>
              </div>

              {/* Free Slots */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">
                  Free Slots
                </p>

                <p className="mt-2 text-3xl font-semibold text-green-600">
                  {freeSlots}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Available for customers
                </p>
              </div>

              {/* Occupied Slots */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">
                  Occupied Slots
                </p>

                <p className="mt-2 text-3xl font-semibold text-orange-600">
                  {occupiedSlots}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Currently in use
                </p>
              </div>
            </div>

            {/* Slot Utilization */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">
                  Slot Utilization
                </h3>

                <span className="text-sm text-gray-500">
                  {totalSlots > 0
                    ? Math.round(
                        (occupiedSlots / totalSlots) * 100
                      )
                    : 0}
                  %
                </span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-orange-500 transition-all"
                  style={{
                    width:
                      totalSlots > 0
                        ? `${(occupiedSlots / totalSlots) * 100}%`
                        : "0%",
                  }}
                />
              </div>
            </div>
          </>
        )}
      </section>

      {/* Queue Rotation Configuration */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Queue Rotation Configuration
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Rules used to manage customer selection and contact
            attempts.
          </p>
        </div>

        {loadingConfig && (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <p className="text-sm text-gray-500">
              Loading queue rotation configuration...
            </p>
          </div>
        )}

        {!loadingConfig && configError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <p className="text-sm text-red-700">
              {configError}
            </p>
          </div>
        )}

        {!loadingConfig && !configError && rotationConfig && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="divide-y divide-gray-100">
              <SettingRow
                label="Rotation Strategy"
                description="The order in which waiting customers are processed."
                value={rotationConfig.strategy}
              />

              <SettingRow
                label="Maximum Candidates"
                description="Maximum number of candidates in a rotation cycle."
                value={rotationConfig.maxCandidates.toString()}
              />

              <SettingRow
                label="Contact Timeout"
                description="Time allowed for a customer to respond."
                value={`${rotationConfig.contactTimeout} seconds`}
              />

              <SettingRow
                label="Retry Attempts"
                description="Maximum number of contact attempts."
                value={rotationConfig.retryAttempts.toString()}
              />

              <SettingRow
                label="Contact Method"
                description="How customers are contacted during queue processing."
                value={rotationConfig.contactMethod}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

interface SettingRowProps {
  label: string;
  description: string;
  value: string;
}

function SettingRow({
  label,
  description,
  value,
}: SettingRowProps) {
  return (
    <div className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-sm font-medium text-gray-900">
          {label}
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          {description}
        </p>
      </div>

      <span className="w-fit rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700">
        {value}
      </span>
    </div>
  );
}