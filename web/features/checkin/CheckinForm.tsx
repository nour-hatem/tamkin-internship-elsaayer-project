'use client';

import { FormEvent, useEffect, useState } from 'react';

type ContactMethod =
  | 'SMS'
  | 'WHATSAPP'
  | 'ELSAAYER_APP'
  | 'CALLING_AGENT';

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

  const [preferredContactMethod, setPreferredContactMethod] =
    useState<ContactMethod | ''>('');

  const [plateLocked, setPlateLocked] = useState(false);
  const [source, setSource] =
    useState<TicketData['source']>('GENERIC');
  const [fallbackMode, setFallbackMode] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [loadingTicket, setLoadingTicket] = useState(true);
  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState('');
  const [ticketId, setTicketId] = useState('');

  const isSapHit = source === 'SAP' && plateLocked;

  useEffect(() => {
    async function loadTicket() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

        const response = await fetch(
          `${apiUrl}/qr/ticket/${token}`,
        );

        if (response.status === 410) {
          try {
            const displayResponse = await fetch(
              `${apiUrl}/qr/display/${gateId}`,
            );

            if (!displayResponse.ok) {
              throw new Error(
                'Unable to load check-in information.',
              );
            }

            const display =
              await displayResponse.json();

            setPlate(display.plate ?? '');
            setName('');
            setPhone('');
            setPreferredContactMethod('');
            setPlateLocked(false);
            setSource('GENERIC');
            setEditMode(false);
            setFallbackMode(true);
            setMessage(
              'Your QR ticket has expired. Please complete the check-in manually.',
            );
          } catch {
            setFallbackMode(false);
            setMessage(
              'Your QR ticket has expired, but the check-in information could not be loaded. Please try again.',
            );
          }

          return;
        }

        if (!response.ok) {
          let errorMessage =
            'Unable to load check-in information.';

          try {
            const data = await response.json();

            if (typeof data.message === 'string') {
              errorMessage = data.message;
            }
          } catch {
            // Ignore invalid error response body.
          }

          throw new Error(errorMessage);
        }

        const ticket: TicketData =
          await response.json();

        setPlate(ticket.plate ?? '');
        setName(ticket.name ?? '');
        setPhone(ticket.phone ?? '');
        setPreferredContactMethod('');
        setPlateLocked(ticket.plateLocked);
        setSource(ticket.source);
        setEditMode(false);
        setFallbackMode(false);
        setMessage('');
      } catch (error) {
        setFallbackMode(false);
        setMessage(
          error instanceof Error
            ? error.message
            : 'Unable to load check-in information.',
        );
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

    if (!preferredContactMethod) {
      setMessage(
        'Please select how you would like to be contacted when your slot is available.',
      );
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL;

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
            preferredContactMethod,
          }
        : {
            token,
            plate,
            name,
            phone,
            preferredContactMethod,
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
          âœ“
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
            ? 'Vehicle recognized â€” information loaded from SAP.'
            : 'Vehicle detected â€” please complete your information.'}
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
          onChange={(event) =>
            setPlate(event.target.value)
          }
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
          onChange={(event) =>
            setName(event.target.value)
          }
          placeholder="Enter your name"
          required
          readOnly={isSapHit && !editMode}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '13px',
            border: '1px solid #ddd',
            borderRadius: '10px',
            fontSize: '15px',
            backgroundColor:
              isSapHit && !editMode
                ? '#f3f3f3'
                : '#fff',
          }}
        />
      </div>

      <div style={{ marginBottom: '18px' }}>
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
          onChange={(event) =>
            setPhone(event.target.value)
          }
          placeholder="Enter phone number"
          required
          readOnly={isSapHit && !editMode}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '13px',
            border: '1px solid #ddd',
            borderRadius: '10px',
            fontSize: '15px',
            backgroundColor:
              isSapHit && !editMode
                ? '#f3f3f3'
                : '#fff',
          }}
        />
      </div>

      <div style={{ marginBottom: '22px' }}>
        <label
          htmlFor="preferredContactMethod"
          style={{
            display: 'block',
            marginBottom: '7px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#333',
          }}
        >
          Preferred Contact Method
        </label>

        <select
          id="preferredContactMethod"
          value={preferredContactMethod}
          onChange={(event) =>
            setPreferredContactMethod(
              event.target.value as ContactMethod,
            )
          }
          required
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '13px',
            border: '1px solid #ddd',
            borderRadius: '10px',
            fontSize: '15px',
            backgroundColor: '#fff',
          }}
        >
          <option value="" disabled>
            Select how you want to be contacted
          </option>

          <option value="SMS">
            SMS
          </option>

          <option value="WHATSAPP">
            WhatsApp
          </option>

          <option value="ELSAAYER_APP">
            ElSaayer App
          </option>

          <option value="CALLING_AGENT">
            Calling Agent
          </option>
        </select>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '10px',
        }}
      >
        <button
          type="submit"
          disabled={loading}
          style={{
            flex: 1,
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
          {loading
            ? 'Checking in...'
            : 'Check In'}
        </button>

        {isSapHit && !editMode && (
          <button
            type="button"
            onClick={() => setEditMode(true)}
            disabled={loading}
            style={{
              flex: 1,
              padding: '14px',
              border: '1px solid #111',
              borderRadius: '10px',
              backgroundColor: '#fff',
              color: '#111',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading
                ? 'not-allowed'
                : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            Edit
          </button>
        )}
      </div>

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