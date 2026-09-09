'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function ConsolePage() {
  const [checkInUrl, setCheckInUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function generateQr() {
  setLoading(true);
  setMessage('');

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    const response = await fetch(`${apiUrl}/qr/ticket`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to create QR ticket.');
    }

    const data = await response.json();

    setCheckInUrl(data.checkInUrl);
    setMessage(`QR generated. Expires in ${data.expiresIn} seconds.`);
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
        maxWidth: '600px',
        margin: '50px auto',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <h1>Toyota Service Center</h1>
      <h2>QR Check-in</h2>

      <button
        onClick={generateQr}
        disabled={loading}
        style={{
          padding: '12px 24px',
          marginBottom: '24px',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Generating...' : 'Generate QR Code'}
      </button>

      {checkInUrl && (
        <div>
          <QRCodeSVG value={checkInUrl} size={250} />

          <p style={{ marginTop: '20px' }}>
            Scan this QR code to check in.
          </p>

          <p style={{ wordBreak: 'break-all', fontSize: '12px' }}>
            {checkInUrl}
          </p>
        </div>
      )}

      {message && <p>{message}</p>}
    </main>
  );
}