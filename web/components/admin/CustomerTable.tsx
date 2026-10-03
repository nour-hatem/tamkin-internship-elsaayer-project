import StatusBadge from "./StatusBadge";
import type { QueueTicket } from "@/types/admin";

interface Props {
  tickets: QueueTicket[];
}

function formatCheckInTime(createdAt: Date | string) {
  return new Date(createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CustomerTable({
  tickets,
}: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
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
            {tickets.map((ticket) => (
              <tr
                key={ticket.ticketId}
                className="border-t border-gray-100"
              >
                <td className="px-5 py-4 font-medium">
                  {ticket.name}
                </td>

                <td className="px-5 py-4">
                  <StatusBadge
                    status={
                      ticket.IsToyotaCustomer
                        ? "TOYOTA_CUSTOMER"
                        : "NEW_CUSTOMER"
                    }
                  />
                </td>

                <td className="px-5 py-4 text-gray-600">
                  {ticket.phone}
                </td>

                <td className="px-5 py-4 font-medium">
                  {ticket.plate}
                </td>

                <td className="px-5 py-4 font-medium">
                  {ticket.ticketId}
                </td>

                <td className="px-5 py-4">
                  <StatusBadge status={ticket.status} />
                </td>

                <td className="px-5 py-4 text-gray-600">
                  {formatCheckInTime(ticket.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}