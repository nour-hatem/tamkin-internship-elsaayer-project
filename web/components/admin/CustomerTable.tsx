import StatusBadge from "./StatusBadge";
import type { Customer } from "@/types/admin";

interface Props {
  customers: Customer[];
}

export default function CustomerTable({
  customers,
}: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-5 py-3">
                Customer
              </th>

              <th className="px-5 py-3">
                Type
              </th>

              <th className="px-5 py-3">
                Phone
              </th>

              <th className="px-5 py-3">
                Vehicle
              </th>

              <th className="px-5 py-3">
                Plate
              </th>

              <th className="px-5 py-3">
                Ticket
              </th>

              <th className="px-5 py-3">
                Status
              </th>

              <th className="px-5 py-3">
                Check-in
              </th>
            </tr>
          </thead>

          <tbody>
            {customers.map((customer) => (
              <tr
                key={customer.id}
                className="border-t border-gray-100"
              >
                <td className="px-5 py-4 font-medium">
                  {customer.name}
                </td>

                <td className="px-5 py-4">
                  <StatusBadge status={customer.type} />
                </td>

                <td className="px-5 py-4 text-gray-600">
                  {customer.phone}
                </td>

                <td className="px-5 py-4 text-gray-600">
                  {customer.vehicle}
                </td>

                <td className="px-5 py-4 font-medium">
                  {customer.plate}
                </td>

                <td className="px-5 py-4 font-medium">
                  {customer.ticket}
                </td>

                <td className="px-5 py-4">
                  <StatusBadge status={customer.status} />
                </td>

                <td className="px-5 py-4 text-gray-600">
                  {customer.checkInTime}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}