import Link from "next/link";
import { notFound } from "next/navigation";
import CurrentCustomerCard from "@/components/admin/CurrentCustomerCard";
import QueueTable from "@/components/admin/QueueTable";
import { adminCustomers, adminGates } from "@/data/admin-mock";

export default async function GateQueuePage({
  params,
}: {
  params: Promise<{ gateId: string }>;
}) {
  const { gateId } = await params;

  const gate = adminGates.find(
    (item) => item.id === gateId
  );

  if (!gate) {
    notFound();
  }

  const customers = adminCustomers.filter(
    (customer) => customer.gateId === gateId
  );

  const currentCustomer = customers.find(
    (customer) =>
      customer.id === gate.currentCustomerId
  );

  const queueCustomers = customers.filter(
    (customer) => customer.status === "WAITING"
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/gates"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Connected Gates
        </Link>

        <div className="mt-4">
          <h1 className="text-2xl font-bold">
            {gate.name}
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            {gate.location}
          </p>
        </div>
      </div>

      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        <Link
          href={`/admin/gates/${gate.id}/queue`}
          className="rounded-md bg-white px-4 py-2 text-sm font-medium shadow-sm"
        >
          Queue
        </Link>

        <Link
          href={`/admin/gates/${gate.id}/customers`}
          className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          Customers
        </Link>
      </div>

      <CurrentCustomerCard
        customer={currentCustomer}
      />

      <QueueTable customers={queueCustomers} />
    </div>
  );
}