'use client';

import { FormEvent, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function CheckInPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('t');

  const [plate, setPlate] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setMessage('Invalid or missing QR token.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/qr/checkin`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            token,
            plate,
            name,
            phone,
        }),
    });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Check-in failed.');
      }

      setMessage(
        `Check-in successful! Your ticket is ${data.queueEntryId}.`,
      );
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

  return (
    <main
      style={{
        maxWidth: '500px',
        margin: '50px auto',
        padding: '24px',
      }}
    >
      <h1>Toyota Service Center</h1>
      <h2>Vehicle Check-in</h2>

      {!token ? (
        <p>Invalid or missing QR token.</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="plate">Plate Number</label>
            <br />
            <input
              id="plate"
              type="text"
              value={plate}
              onChange={(event) => setPlate(event.target.value)}
              required
              style={{ width: '100%', padding: '10px' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="name">Name</label>
            <br />
            <input
              id="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              style={{ width: '100%', padding: '10px' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="phone">Phone</label>
            <br />
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
              style={{ width: '100%', padding: '10px' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
            }}
          >
            {loading ? 'Checking in...' : 'Check In'}
          </button>
        </form>
      )}

      {message && (
        <p style={{ marginTop: '20px' }}>
          {message}
        </p>
      )}
    </main>
  );
}