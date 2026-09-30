import StatusBadge from "./StatusBadge";
import type { Customer } from "@/types/admin";

interface Props {
  customer?: Customer;
}

export default function CurrentCustomerCard({
  customer,
}: Props) {
  if (!customer) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-500">
          No customer is currently in service.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Currently In Service
          </p>

          <h2 className="mt-1 text-xl font-semibold">
            {customer.name}
          </h2>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <span>{customer.vehicle}</span>
            <span>•</span>
            <span>{customer.plate}</span>
          </div>
        </div>

        <StatusBadge status={customer.status} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-gray-500">
            Ticket
          </p>

          <p className="mt-1 font-semibold">
            {customer.ticket}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500">
            Check-in
          </p>

          <p className="mt-1 font-semibold">
            {customer.checkInTime}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500">
            Wait Time
          </p>

          <p className="mt-1 font-semibold">
            {customer.waitTime ?? "—"}
          </p>
        </div>
      </div>
    </div>
  );
}