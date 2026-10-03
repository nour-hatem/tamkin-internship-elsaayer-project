"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

const mockSettings = {
  totalSlots: 5,
  occupiedSlots: 2,
  rotationStrategy: "FIFO",
  maxCandidates: 3,
  contactTimeout: 30,
  maxRetries: 3,
  contactMethod: "Customer Preference",
};

export default function GateSettingsPage() {
  const params = useParams();
  const gateId = params.gateId as string;

  // Temporary mock values for UI development.
  const [settings] = useState(mockSettings);

  const freeSlots = settings.totalSlots - settings.occupiedSlots;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Gate Settings
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          View slot availability and queue rotation configuration for Gate{" "}
          {gateId}.
        </p>
      </div>

      {/* Slot Availability */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Slot Availability
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Overview of the current service slot capacity.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total Slots</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {settings.totalSlots}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Occupied Slots</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {settings.occupiedSlots}
            </p>
          </div>

          <div className="rounded-xl border border-green-200 bg-green-50 p-5 shadow-sm">
            <p className="text-sm text-green-700">Free Slots</p>
            <p className="mt-2 text-3xl font-semibold text-green-800">
              {freeSlots}
            </p>
          </div>
        </div>

        {/* Slot Occupancy */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              Slot Occupancy
            </p>

            <p className="text-sm text-gray-500">
              {settings.occupiedSlots} of {settings.totalSlots} occupied
            </p>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-red-600 transition-all"
              style={{
                width: `${
                  (settings.occupiedSlots / settings.totalSlots) * 100
                }%`,
              }}
            />
          </div>
        </div>
      </section>

      {/* Queue Rotation Configuration */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Queue Rotation Configuration
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Current mock configuration for customer calling and queue rotation.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="divide-y divide-gray-100">
            <SettingRow
              label="Rotation Strategy"
              value={settings.rotationStrategy}
              description="Customers are handled in first-in, first-out order."
            />

            <SettingRow
              label="Maximum Candidates"
              value={String(settings.maxCandidates)}
              description="Maximum candidates considered in one rotation."
            />

            <SettingRow
              label="Contact Timeout"
              value={`${settings.contactTimeout} seconds`}
              description="Time allowed for a customer to respond."
            />

            <SettingRow
              label="Maximum Retries"
              value={String(settings.maxRetries)}
              description="Maximum retry attempts during contact handling."
            />

            <SettingRow
              label="Contact Method"
              value={settings.contactMethod}
              description="Uses the customer's preferred contact method."
            />
          </div>
        </div>
      </section>

      <p className="text-xs text-gray-400">
        These are demonstration values only. Actual slot availability and queue
        configuration should come from the backend.
      </p>
    </div>
  );
}

interface SettingRowProps {
  label: string;
  value: string;
  description: string;
}

function SettingRow({ label, value, description }: SettingRowProps) {
  return (
    <div className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-gray-900">{label}</p>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>

      <span className="w-fit shrink-0 rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-800">
        {value}
      </span>
    </div>
  );
}