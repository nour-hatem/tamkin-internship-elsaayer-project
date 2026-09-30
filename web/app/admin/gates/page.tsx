import Link from "next/link";
import StatusBadge from "@/components/admin/StatusBadge";
import { adminGates } from "@/data/admin-mock";

export default function ConnectedGatesPage() {
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

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {adminGates.map((gate) => (
          <Link
            key={gate.id}
            href={`/admin/gates/${gate.id}`}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {gate.name}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {gate.location}
                </p>
              </div>

              <StatusBadge status={gate.status} />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">
                  Waiting
                </p>

                <p className="mt-1 text-2xl font-semibold">
                  {gate.waitingCount}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">
                  Current Ticket
                </p>

                <p className="mt-1 text-2xl font-semibold">
                  {gate.currentTicket ?? "—"}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}