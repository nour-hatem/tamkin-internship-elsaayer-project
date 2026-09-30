import Link from "next/link";
import StatCard from "@/components/admin/StatCard";
import StatusBadge from "@/components/admin/StatusBadge";
import {
  adminActivityLogs,
  adminAnalytics,
  adminCustomers,
  adminGates,
} from "@/data/admin-mock";

export default function AdminDashboard() {
  const connectedGates = adminGates.filter(
    (gate) => gate.status === "CONNECTED"
  ).length;

  const offlineGates = adminGates.filter(
    (gate) => gate.status === "OFFLINE"
  ).length;

  const waitingCustomers = adminCustomers.filter(
    (customer) => customer.status === "WAITING"
  ).length;

  const inService = adminCustomers.filter(
    (customer) => customer.status === "IN_SERVICE"
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Connected Gates"
          value={`${connectedGates} / ${adminGates.length}`}
          description={`${offlineGates} gate offline`}
        />

        <StatCard
          title="Waiting Customers"
          value={waitingCustomers}
        />

        <StatCard
          title="Currently In Service"
          value={inService}
        />

        <StatCard
          title="Completed Today"
          value={adminAnalytics.completedCheckIns}
        />
      </div>

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

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {adminGates.map((gate) => (
            <Link
              key={gate.id}
              href={`/admin/gates/${gate.id}`}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">
                    {gate.name}
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    {gate.location}
                  </p>
                </div>

                <StatusBadge status={gate.status} />
              </div>

              <div className="mt-5">
                <p className="text-sm text-gray-500">
                  Waiting
                </p>

                <p className="text-2xl font-semibold">
                  {gate.waitingCount}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">
          Recent Activity
        </h2>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {adminActivityLogs.slice(0, 5).map((log) => (
            <div
              key={log.id}
              className="flex flex-col gap-2 border-b border-gray-100 p-4 last:border-0 sm:flex-row sm:items-center"
            >
              <span className="w-20 text-xs text-gray-400">
                {log.timestamp}
              </span>

              <span className="font-medium">
                {log.event}
              </span>

              <span className="text-sm text-gray-500">
                {log.description}
              </span>

              <div className="sm:ml-auto">
                <StatusBadge status={log.status} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}