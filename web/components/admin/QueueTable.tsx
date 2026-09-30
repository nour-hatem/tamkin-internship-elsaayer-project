import TicketPopover from "./TicketPopover";
import type { QueueTicket, QueueTicketStatus } from "@/types/admin";

interface Props {
  tickets: QueueTicket[];
}

function formatCheckInTime(createdAt: Date | string) {
  return new Date(createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusStyle(status: QueueTicketStatus) {
  switch (status) {
    case "WAITING":
      return "bg-amber-50 text-amber-700";

    case "CALLED":
      return "bg-blue-50 text-blue-700";

    case "ACKNOWLEDGED":
      return "bg-purple-50 text-purple-700";

    case "IN_SERVICE":
      return "bg-green-50 text-green-700";

    default:
      return "bg-gray-50 text-gray-700";
  }
}

function formatStatus(status: QueueTicketStatus) {
  return status.replace("_", " ");
}

export default function QueueTable({
  tickets,
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
                Check-in Time
              </th>

              <th className="px-5 py-3">
                Status
              </th>
            </tr>
          </thead>

          <tbody>
            {tickets.map((ticket) => (
              <tr
                key={ticket.ticketId}
                className="border-t border-gray-100"
              >
                <td className="px-5 py-4 text-gray-500">
                  {ticket.queueNumber}
                </td>

                <td className="px-5 py-4">
                  <TicketPopover ticket={ticket} />
                </td>

                <td className="px-5 py-4 text-gray-600">
                  {formatCheckInTime(ticket.createdAt)}
                </td>

                <td className="px-5 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusStyle(
                      ticket.status,
                    )}`}
                  >
                    {formatStatus(ticket.status)}
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