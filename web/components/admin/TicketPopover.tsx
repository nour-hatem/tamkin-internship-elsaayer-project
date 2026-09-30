"use client";

import { useState } from "react";
import StatusBadge from "./StatusBadge";
import type { Customer } from "@/types/admin";

interface Props {
  customer: Customer;
}

export default function TicketPopover({
  customer,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button className="font-semibold text-red-600 hover:text-red-700">
        {customer.ticket}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-900">
                {customer.name}
              </p>

              <p className="mt-1 text-xs text-gray-500">
                {customer.vehicle}
              </p>
            </div>

            <StatusBadge status={customer.type} />
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">
                Plate
              </span>

              <span className="font-medium">
                {customer.plate}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">
                Check-in
              </span>

              <span className="font-medium">
                {customer.checkInTime}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">
                Status
              </span>

              <StatusBadge status={customer.status} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}