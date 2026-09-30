import type {
  ActivityStatus,
  CustomerStatus,
  CustomerType,
  GateStatus,
  QueueTicketStatus,
} from "@/types/admin";

type Status =
  | GateStatus
  | CustomerStatus
  | CustomerType
  | ActivityStatus
  | QueueTicketStatus;

interface StatusBadgeProps {
  status: Status;
}

export default function StatusBadge({
  status,
}: StatusBadgeProps) {
  const config: Record<
    Status,
    {
      label: string;
      className: string;
    }
  > = {
    CONNECTED: {
      label: "Connected",
      className: "bg-green-50 text-green-700",
    },

    OFFLINE: {
      label: "Offline",
      className: "bg-red-50 text-red-700",
    },

    WAITING: {
      label: "Waiting",
      className: "bg-amber-50 text-amber-700",
    },

    CALLED: {
      label: "Called",
      className: "bg-blue-50 text-blue-700",
    },

    ACKNOWLEDGED: {
      label: "Acknowledged",
      className: "bg-purple-50 text-purple-700",
    },

    IN_SERVICE: {
      label: "In Service",
      className: "bg-green-50 text-green-700",
    },

    COMPLETED: {
      label: "Completed",
      className: "bg-green-50 text-green-700",
    },

    SKIPPED: {
      label: "Skipped",
      className: "bg-gray-50 text-gray-700",
    },

    TOYOTA_CUSTOMER: {
      label: "Toyota Customer",
      className: "bg-red-50 text-red-700",
    },

    NEW_CUSTOMER: {
      label: "New Customer",
      className: "bg-blue-50 text-blue-700",
    },

    SUCCESS: {
      label: "Success",
      className: "bg-green-50 text-green-700",
    },

    WARNING: {
      label: "Warning",
      className: "bg-amber-50 text-amber-700",
    },

    ERROR: {
      label: "Error",
      className: "bg-red-50 text-red-700",
    },

    INFO: {
      label: "Info",
      className: "bg-blue-50 text-blue-700",
    },
  };

  const item = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${item.className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {item.label}
    </span>
  );
}