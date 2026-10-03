'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AdminGate,
  getAdminGates,
  getAdminQueue,
  QueueTicket,
  QueueTicketStatus,
} from '../../../lib/api';
import {
  joinAdminGateRoom,
  leaveAdminGateRoom,
  subscribeToQueueTicketAdded,
  subscribeToQueueTicketStatusUpdated,
} from '../../../lib/socket';

const statusOptions: Array<QueueTicketStatus | 'ALL'> = [
  'ALL',
  'WAITING',
  'CALLED',
  'ACKNOWLEDGED',
  'IN_SERVICE',
  'COMPLETED',
  'NO_SHOW',
];

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function getStatusLabel(status: QueueTicketStatus): string {
  switch (status) {
    case 'WAITING':
      return 'Waiting';

    case 'CALLED':
      return 'Called';

    case 'ACKNOWLEDGED':
      return 'Acknowledged';

    case 'IN_SERVICE':
      return 'In Service';

    case 'COMPLETED':
      return 'Completed';

    case 'SKIPPED':
      return 'No Show';

    case 'NO_SHOW':
      return 'No Show';

    default:
      return status;
  }
}

function getStatusStyle(status: QueueTicketStatus): React.CSSProperties {
  switch (status) {
    case 'WAITING':
      return {
        backgroundColor: '#fef3c7',
        color: '#92400e',
      };

    case 'CALLED':
      return {
        backgroundColor: '#dbeafe',
        color: '#1d4ed8',
      };

    case 'ACKNOWLEDGED':
      return {
        backgroundColor: '#dcfce7',
        color: '#166534',
      };

    case 'IN_SERVICE':
      return {
        backgroundColor: '#e0e7ff',
        color: '#3730a3',
      };

    case 'COMPLETED':
      return {
        backgroundColor: '#d1fae5',
        color: '#065f46',
      };

    case 'SKIPPED':
      return {
        backgroundColor: '#fee2e2',
        color: '#991b1b',
      };

    case 'NO_SHOW':
      return {
        backgroundColor: '#fee2e2',
        color: '#b91c1c',
        border: '1px solid #fecaca',
      };

    default:
      return {
        backgroundColor: '#f3f4f6',
        color: '#374151',
      };
  }
}

function upsertTicket(tickets: QueueTicket[], incoming: QueueTicket): QueueTicket[] {
  const index = tickets.findIndex((ticket) => ticket.ticketId === incoming.ticketId);

  if (index === -1) {
    return [incoming, ...tickets];
  }

  const updated = [...tickets];
  updated[index] = incoming;

  return updated;
}

export default function QueueMonitoringPage() {
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [gates, setGates] = useState<AdminGate[]>([]);

  const [selectedGate, setSelectedGate] = useState<string>('ALL');

  const [selectedStatus, setSelectedStatus] = useState<QueueTicketStatus | 'ALL'>('ALL');

  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const unsubscribeAdded = subscribeToQueueTicketAdded(({ ticket }) => {
      if (!ticket) {
        return;
      }

      setTickets((previous) => upsertTicket(previous, ticket));
    });

    const unsubscribeStatus = subscribeToQueueTicketStatusUpdated(({ ticketId, status }) => {
      if (!ticketId || !status) {
        return;
      }

      setTickets((previous) =>
        previous.map((ticket) =>
          ticket.ticketId === ticketId
            ? {
                ...ticket,
                status: status as QueueTicketStatus,
              }
            : ticket,
        ),
      );
    });

    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);

        const [queueResponse, gatesResponse] = await Promise.all([
          getAdminQueue(),
          getAdminGates(),
        ]);

        if (!mounted) {
          return;
        }

        setTickets(queueResponse.tickets ?? []);
        setGates(gatesResponse.gates ?? []);

        /*
         * Join currently connected gate rooms.
         */
        (gatesResponse.gates ?? []).forEach((gate) => {
          const gateId = gate.gateId || gate.id;

          if (gateId) {
            joinAdminGateRoom(gateId);
          }
        });

        /*
         * /admin/gates only returns currently connected gates.
         *
         * A ticket can still contain a gateId even when
         * that gate is not currently connected.
         *
         * Therefore, also join the rooms represented by
         * the existing queue tickets.
         */
        (queueResponse.tickets ?? []).forEach((ticket) => {
          if (ticket.gateId) {
            joinAdminGateRoom(ticket.gateId);
          }
        });
      } catch (err) {
        if (!mounted) {
          return;
        }

        const message = err instanceof Error ? err.message : 'Unknown error';

        setError(`Failed to load queue monitoring data: ${message}`);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      mounted = false;

      unsubscribeAdded();
      unsubscribeStatus();
    };
  }, []);

  /*
   * Join rooms for both:
   * 1. Connected gates
   * 2. Gates represented by queue tickets
   *
   * This is important because /admin/gates may be empty
   * while existing tickets still contain valid gateIds.
   *
   * It also keeps the admin socket subscribed to the correct
   * rooms when the queue receives new tickets.
   */
  useEffect(() => {
    gates.forEach((gate) => {
      const gateId = gate.gateId || gate.id;

      if (gateId) {
        joinAdminGateRoom(gateId);
      }
    });

    tickets.forEach((ticket) => {
      if (ticket.gateId) {
        joinAdminGateRoom(ticket.gateId);
      }
    });
  }, [gates, tickets]);

  /*
   * Build the list of gates available for filtering.
   *
   * /admin/gates returns currently connected gates only.
   * A queue ticket can still contain a gateId even when
   * that gate is not currently connected.
   *
   * Therefore we combine:
   *   1. Connected gates
   *   2. Gates represented by existing queue tickets
   */
  const availableGates = useMemo(() => {
    const gateMap = new Map<string, string>();

    // Connected gates
    gates.forEach((gate) => {
      const gateId = gate.gateId || gate.id;

      if (gateId) {
        gateMap.set(gateId, gate.name || gateId);
      }
    });

    // Gates represented in queue tickets
    tickets.forEach((ticket) => {
      if (ticket.gateId && !gateMap.has(ticket.gateId)) {
        const match = ticket.gateId.match(/^gate[-_]?(\d+)$/i);

        const label = match ? `Gate ${match[1]}` : ticket.gateId;

        gateMap.set(ticket.gateId, label);
      }
    });

    return Array.from(gateMap.entries()).map(([gateId, name]) => ({
      gateId,
      name,
    }));
  }, [gates, tickets]);

  const filteredTickets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return tickets
      .filter((ticket) => {
        if (selectedGate !== 'ALL' && ticket.gateId !== selectedGate) {
          return false;
        }

        if (selectedStatus !== 'ALL' && ticket.status !== selectedStatus) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return (
          ticket.ticketId.toLowerCase().includes(normalizedSearch) ||
          ticket.plate.toLowerCase().includes(normalizedSearch) ||
          ticket.name.toLowerCase().includes(normalizedSearch)
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [tickets, selectedGate, selectedStatus, search]);

  const waitingCount = tickets.filter((ticket) => ticket.status === 'WAITING').length;

  const calledCount = tickets.filter((ticket) => ticket.status === 'CALLED').length;

  const inServiceCount = tickets.filter((ticket) => ticket.status === 'IN_SERVICE').length;

  const noShowCount = tickets.filter(
    (ticket) => ticket.status === 'NO_SHOW' || ticket.status === 'SKIPPED',
  ).length;

  const cardStyle: React.CSSProperties = {
    padding: '20px',
    background: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    flex: '1 1 180px',
    minWidth: '160px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '8px',
  };

  const valueStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: 700,
    color: '#111827',
  };

  const selectStyle: React.CSSProperties = {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    background: '#fff',
    color: '#111827',
    minWidth: '170px',
    fontSize: '14px',
  };

  const inputStyle: React.CSSProperties = {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    background: '#fff',
    color: '#111827',
    minWidth: '240px',
    fontSize: '14px',
  };

  return (
    <div
      style={{
        padding: '40px',
        maxWidth: '1400px',
        margin: '0 auto',
        background: '#f9fafb',
        minHeight: '100vh',
      }}
    >
      <div
        style={{
          marginBottom: '28px',
        }}
      >
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#eb0a1e',
            marginBottom: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Admin Dashboard
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: '30px',
            fontWeight: 700,
            color: '#111827',
          }}
        >
          Queue Monitoring
        </h1>

        <p
          style={{
            marginTop: '8px',
            marginBottom: 0,
            color: '#6b7280',
            fontSize: '15px',
          }}
        >
          Monitor customer queues and ticket status across all connected gates in real time.
        </p>
      </div>

      {error && (
        <div
          style={{
            marginBottom: '24px',
            padding: '14px 16px',
            borderRadius: '8px',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            border: '1px solid #fecaca',
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          marginBottom: '28px',
        }}
      >
        <div style={cardStyle}>
          <div style={labelStyle}>Total Tickets</div>
          <div style={valueStyle}>{tickets.length}</div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>Waiting</div>
          <div style={valueStyle}>{waitingCount}</div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>Called</div>
          <div style={valueStyle}>{calledCount}</div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>In Service</div>
          <div style={valueStyle}>{inServiceCount}</div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>No Shows</div>
          <div style={valueStyle}>{noShowCount}</div>
        </div>
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          padding: '20px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <select
            value={selectedGate}
            onChange={(event) => setSelectedGate(event.target.value)}
            style={selectStyle}
            aria-label="Filter by gate"
          >
            <option value="ALL">All Gates</option>

            {availableGates.map((gate) => (
              <option key={gate.gateId} value={gate.gateId}>
                {gate.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(event) => setSelectedStatus(event.target.value as QueueTicketStatus | 'ALL')}
            style={selectStyle}
            aria-label="Filter by status"
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status === 'ALL' ? 'All Statuses' : getStatusLabel(status)}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search ticket, plate, or customer..."
            style={inputStyle}
            aria-label="Search queue"
          />
        </div>
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 700,
                color: '#111827',
              }}
            >
              Queue Tickets
            </h2>

            <p
              style={{
                margin: '5px 0 0',
                color: '#6b7280',
                fontSize: '13px',
              }}
            >
              Showing {filteredTickets.length} of {tickets.length} tickets
            </p>
          </div>

          <div
            style={{
              fontSize: '13px',
              color: '#16a34a',
              fontWeight: 600,
            }}
          >
            ● Live
          </div>
        </div>

        {loading ? (
          <div
            style={{
              padding: '50px',
              textAlign: 'center',
              color: '#6b7280',
            }}
          >
            Loading queue...
          </div>
        ) : filteredTickets.length === 0 ? (
          <div
            style={{
              padding: '50px',
              textAlign: 'center',
              color: '#6b7280',
            }}
          >
            No queue tickets match the current filters.
          </div>
        ) : (
          <div
            style={{
              overflowX: 'auto',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: '1100px',
              }}
            >
              <thead>
                <tr
                  style={{
                    background: '#f9fafb',
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  <th style={headerStyle}>Queue</th>

                  <th style={headerStyle}>Ticket</th>

                  <th style={headerStyle}>Customer</th>

                  <th style={headerStyle}>Plate</th>

                  <th style={headerStyle}>Gate</th>

                  <th style={headerStyle}>Source</th>

                  <th style={headerStyle}>Customer Type</th>

                  <th style={headerStyle}>Contact</th>

                  <th style={headerStyle}>Status</th>

                  <th style={headerStyle}>Created</th>
                </tr>
              </thead>

              <tbody>
                {filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.ticketId}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    <td style={cellStyle}>
                      <strong>#{ticket.queueNumber}</strong>
                    </td>

                    <td style={cellStyle}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          color: '#4b5563',
                        }}
                      >
                        {ticket.ticketId}
                      </span>
                    </td>

                    <td style={cellStyle}>
                      <div
                        style={{
                          fontWeight: 600,
                          color: '#111827',
                        }}
                      >
                        {ticket.name}
                      </div>

                      <div
                        style={{
                          marginTop: '3px',
                          fontSize: '12px',
                          color: '#6b7280',
                        }}
                      >
                        {ticket.phone}
                      </div>
                    </td>

                    <td style={cellStyle}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 600,
                        }}
                      >
                        {ticket.plate}
                      </span>
                    </td>

                    <td style={cellStyle}>{ticket.gateId}</td>

                    <td style={cellStyle}>
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: '999px',
                          background: ticket.source === 'QR' ? '#ede9fe' : '#e0f2fe',
                          color: ticket.source === 'QR' ? '#6d28d9' : '#0369a1',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        {ticket.source}
                      </span>
                    </td>

                    <td style={cellStyle}>
                      {ticket.isToyotaCustomer ? (
                        <span
                          style={{
                            color: '#166534',
                            fontWeight: 600,
                          }}
                        >
                          Toyota Customer
                        </span>
                      ) : (
                        <span
                          style={{
                            color: '#6b7280',
                          }}
                        >
                          New Customer
                        </span>
                      )}
                    </td>

                    <td style={cellStyle}>
                      <span
                        style={{
                          fontSize: '12px',
                        }}
                      >
                        {ticket.preferredContactMethod}
                      </span>
                    </td>

                    <td style={cellStyle}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '5px 9px',
                          borderRadius: '999px',
                          fontSize: '12px',
                          fontWeight: 600,
                          ...getStatusStyle(ticket.status),
                        }}
                      >
                        {getStatusLabel(ticket.status)}
                      </span>
                    </td>

                    <td style={cellStyle}>
                      <div
                        style={{
                          fontSize: '13px',
                          color: '#374151',
                        }}
                      >
                        {formatDate(ticket.createdAt)}
                      </div>

                      <div
                        style={{
                          marginTop: '3px',
                          fontSize: '12px',
                          color: '#9ca3af',
                        }}
                      >
                        {formatTime(ticket.createdAt)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: '16px',
          fontSize: '12px',
          color: '#6b7280',
        }}
      >
        Queue updates are received in real time from the connected gate rooms. A NO_SHOW ticket is
        displayed as a red No Show event.
      </div>
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  padding: '13px 16px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: 700,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  whiteSpace: 'nowrap',
};

const cellStyle: React.CSSProperties = {
  padding: '14px 16px',
  fontSize: '13px',
  color: '#374151',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
};
