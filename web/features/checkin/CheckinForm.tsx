'use client';

import { FormEvent, useEffect, useState } from 'react';

type TicketData = {
  gateId: string;
  plate?: string;
  plateLocked: boolean;
  name?: string;
  phone?: string;
  source: 'GENERIC' | 'LPR' | 'SAP';
};

type CheckinFormProps = {
  token: string;
  gateId: string;
};

export default function CheckinForm({
  token,
  gateId,
}: CheckinFormProps) {
  const [plate, setPlate] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const [plateLocked, setPlateLocked] = useState(false);
  const [source, setSource] =
    useState<TicketData['source']>('GENERIC');
  const [fallbackMode, setFallbackMode] = useState(false);

  const [loadingTicket, setLoadingTicket] = useState(true);
  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState('');
  const [ticketId, setTicketId] = useState('');

  useEffect(() => {
    async function loadTicket() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;

        const response = await fetch(
          `${apiUrl}/qr/ticket/${token}`,
        );

        if (!response.ok) {
          throw new Error(
            'This QR code is expired or has already been used.',
          );
        }

        const ticket: TicketData = await response.json();

        setPlate(ticket.plate ?? '');
        setName(ticket.name ?? '');
        setPhone(ticket.phone ?? '');
        setPlateLocked(ticket.plateLocked);
        setSource(ticket.source);
        setFallbackMode(false);
      } catch {
        // QR ticket is expired or already used.
        // Fall back to the generic check-in flow.
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL;

          const response = await fetch(
            `${apiUrl}/qr/display/${gateId}`,
          );

          if (!response.ok) {
            throw new Error(
              'Unable to load check-in information.',
            );
          }

          const display = await response.json();

          setPlate(display.plate ?? '');
          setName('');
          setPhone('');
          setPlateLocked(false);
          setSource('GENERIC');
          setFallbackMode(true);
          setMessage(
            'Your QR ticket has expired. Please complete the check-in manually.',
          );
        } catch {
          setPlate('');
          setName('');
          setPhone('');
          setPlateLocked(false);
          setSource('GENERIC');
          setFallbackMode(true);
          setMessage(
            'Your QR ticket has expired. Please complete the check-in manually.',
          );
        }
      } finally {
        setLoadingTicket(false);
      }
    }

    loadTicket();
  }, [token, gateId]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLoading(true);
    setMessage('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      const endpoint = fallbackMode
        ? `${apiUrl}/checkin/submit`
        : `${apiUrl}/qr/checkin`;

      const body = fallbackMode
        ? {
            gateId,
            plate,
            name,
            phone,
            source: 'QR',
          }
        : {
            token,
            plate,
            name,
            phone,
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.status === 409) {
        throw new Error(
          'This vehicle is already waiting in the queue.',
        );
      }

      if (response.status === 410) {
        throw new Error(
          'This QR code has expired or has already been used.',
        );
      }

      if (!response.ok) {
        throw new Error(
          data.message || 'Check-in failed.',
        );
      }

      setTicketId(data.queueEntryId);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (loadingTicket) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '30px',
        }}
      >
        Loading check-in...
      </div>
    );
  }

  if (ticketId) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '20px 8px',
        }}
      >
        <div
          style={{
            fontSize: '48px',
            marginBottom: '20px',
          }}
        >
          ✓
        </div>

        <h2
          style={{
            margin: 0,
            fontSize: '25px',
            color: '#111',
          }}
        >
          Check-in Successful
        </h2>

        <p
          style={{
            marginTop: '12px',
            color: '#666',
          }}
        >
          Your vehicle has been added to the queue.
        </p>

        <div
          style={{
            marginTop: '24px',
            padding: '18px',
            backgroundColor: '#f7f7f7',
            borderRadius: '14px',
          }}
        >
          <div
            style={{
              fontSize: '13px',
              color: '#777',
              marginBottom: '6px',
            }}
          >
            Your Ticket
          </div>

          <strong
            style={{
              fontSize: '25px',
              color: '#111',
            }}
          >
            {ticketId}
          </strong>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {fallbackMode && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px',
            backgroundColor: '#f7f7f7',
            borderRadius: '10px',
            fontSize: '13px',
            color: '#555',
            textAlign: 'center',
          }}
        >
          Your QR ticket has expired. You can still
          complete your check-in below.
        </div>
      )}

      {!fallbackMode && source !== 'GENERIC' && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px',
            backgroundColor: '#f7f7f7',
            borderRadius: '10px',
            fontSize: '13px',
            color: '#555',
            textAlign: 'center',
          }}
        >
          {source === 'SAP'
            ? 'Vehicle recognized — information loaded from SAP.'
            : 'Vehicle detected — please complete your information.'}
        </div>
      )}

      <div style={{ marginBottom: '18px' }}>
        <label
          htmlFor="plate"
          style={{
            display: 'block',
            marginBottom: '7px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#333',
          }}
        >
          Plate Number
        </label>

        <input
          id="plate"
          type="text"
          value={plate}
          onChange={(event) => setPlate(event.target.value)}
          placeholder="Enter plate number"
          required
          readOnly={plateLocked}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '13px',
            border: '1px solid #ddd',
            borderRadius: '10px',
            fontSize: '15px',
            backgroundColor: plateLocked
              ? '#f3f3f3'
              : '#fff',
          }}
        />

        {plateLocked && (
          <small
            style={{
              display: 'block',
              marginTop: '6px',
              color: '#777',
            }}
          >
            Plate detected and verified.
          </small>
        )}
      </div>

      <div style={{ marginBottom: '18px' }}>
        <label
          htmlFor="name"
          style={{
            display: 'block',
            marginBottom: '7px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#333',
          }}
        >
          Full Name
        </label>

        <input
          id="name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Enter your name"
          required
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '13px',
            border: '1px solid #ddd',
            borderRadius: '10px',
            fontSize: '15px',
          }}
        />
      </div>

      <div style={{ marginBottom: '22px' }}>
        <label
          htmlFor="phone"
          style={{
            display: 'block',
            marginBottom: '7px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#333',
          }}
        >
          Phone Number
        </label>

        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="Enter phone number"
          required
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '13px',
            border: '1px solid #ddd',
            borderRadius: '10px',
            fontSize: '15px',
          }}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%',
          padding: '14px',
          border: 'none',
          borderRadius: '10px',
          backgroundColor: '#111',
          color: '#fff',
          fontSize: '16px',
          fontWeight: '600',
          cursor: loading
            ? 'not-allowed'
            : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Checking in...' : 'Check In'}
      </button>

      {message && (
        <div
          style={{
            marginTop: '18px',
            padding: '12px',
            backgroundColor: '#fafafa',
            borderRadius: '10px',
            color: '#c62828',
            fontSize: '14px',
            textAlign: 'center',
          }}
        >
          {message}
        </div>
      )}
    </form>
  );
}