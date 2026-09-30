import TicketPopover from "./TicketPopover";
import type { Customer } from "@/types/admin";

interface Props {
  customers: Customer[];
}

export default function QueueTable({
  customers,
}: Props) {
  return (
    <div className="overflow-visible rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="font-semibold">
          Queue
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Hover over a ticket to view customer information.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-5 py-3">
                Position
              </th>

              <th className="px-5 py-3">
                Ticket
              </th>

              <th className="px-5 py-3">
                Status
              </th>
            </tr>
          </thead>

          <tbody>
            {customers.map((customer, index) => (
              <tr
                key={customer.id}
                className="border-t border-gray-100"
              >
                <td className="px-5 py-4 text-gray-500">
                  {index + 1}
                </td>

                <td className="px-5 py-4">
                  <TicketPopover customer={customer} />
                </td>

                <td className="px-5 py-4">
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                    Waiting
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}