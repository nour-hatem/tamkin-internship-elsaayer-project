"use client";

import { useState } from "react";
import type { QueueTicket } from "@/types/admin";

interface Props {
  ticket: QueueTicket;
}

export default function TicketPopover({ ticket }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button className="font-semibold text-red-600 hover:text-red-700">
        #{ticket.queueNumber}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-xl">
          <p className="font-semibold text-gray-900">
            {ticket.name}
          </p>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Phone</span>

              <span className="font-medium">
                {ticket.phone}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Plate</span>

              <span className="font-medium">
                {ticket.plate}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}