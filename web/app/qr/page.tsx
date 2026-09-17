'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { joinGateRoom, subscribeToCheckinDisplay } from '@/lib/socket';
import { QRCodeSVG } from 'qrcode.react';

const QR_LIFETIME = 180;

// useSearchParams() opts this tree out of static rendering unless it's
// wrapped in a Suspense boundary, so the actual page content lives here
// and the default export below wraps it in <Suspense>.
function QrPageContent() {
  const searchParams = useSearchParams();
  const gateId = searchParams.get('gateId') || 'gate-1';

  const [loading, setLoading] = useState(false);

  const [checkInUrl, setCheckInUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [qrMessage, setQrMessage] = useState('');

  // Join the gate room so this page receives live check-in display updates
  useEffect(() => {
    joinGateRoom(gateId, 'qr');
  }, [gateId]);

  // Load the current QR display for the selected gate
  useEffect(() => {
    const loadDisplay = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

        const response = await fetch(`${apiUrl}/qr/display/${gateId}`);

        if (!response.ok) {
          throw new Error('Failed to load QR display.');
        }

        const display = await response.json();

        if (display.checkInUrl) {
          setCheckInUrl(display.checkInUrl);
          setExpiresAt(display.expiresAt || '');

          setRemainingSeconds(
            display.expiresAt
              ? Math.max(0, Math.ceil((new Date(display.expiresAt).getTime() - Date.now()) / 1000))
              : 0,
          );

          setQrMessage('');
        } else {
          setCheckInUrl('');
          setExpiresAt('');
          setRemainingSeconds(0);
          setQrMessage('');
        }
      } catch (error) {
        console.error('[QR] Failed to load QR display:', error);
      }
    };

    loadDisplay();

    const unsubscribe = subscribeToCheckinDisplay(async (data) => {
      if (data.gateId !== gateId) {
        return;
      }

      await loadDisplay();
    });

    return unsubscribe;
  }, [gateId]);

  // Update QR countdown every second
  useEffect(() => {
    if (!expiresAt) {
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));

      setRemainingSeconds(remaining);

      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  async function generateQr() {
    setLoading(true);
    setQrMessage('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

      const response = await fetch(`${apiUrl}/qr/ticket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gateId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create QR ticket.');
      }

      const data = await response.json();

      setCheckInUrl(data.checkInUrl);
      setExpiresAt(data.expiresAt);
      setRemainingSeconds(data.expiresIn);
      setQrMessage('');
    } catch (error) {
      setQrMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  const isExpired = checkInUrl !== '' && remainingSeconds === 0;

  const minutes = Math.floor(remainingSeconds / 60);

  const seconds = remainingSeconds % 60;

  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const progress = (remainingSeconds / QR_LIFETIME) * 100;

  return (
    <div
      style={{
        padding: '20px',
        maxWidth: '480px',
        margin: '0 auto',
      }}
    >
      <h1 style={{ color: '#eb0a1e', textAlign: 'center' }}>Toyota Service Center</h1>

      <p style={{ textAlign: 'center', color: '#666', marginBottom: '20px' }}>
        Gate: <strong>{gateId}</strong>
      </p>

      <div
        style={{
          background: '#fff',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          textAlign: 'center',
        }}
      >
        <h3>QR Check-in</h3>

        {!checkInUrl && (
          <>
            <p style={{ color: '#666' }}>Generate a QR code for the customer.</p>

            <button
              onClick={generateQr}
              disabled={loading}
              style={{
                padding: '12px 24px',
                backgroundColor: '#111',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              {loading ? 'Generating...' : 'Generate QR Code'}
            </button>
          </>
        )}

        {checkInUrl && !isExpired && (
          <>
            <div
              style={{
                display: 'inline-flex',
                padding: '16px',
                background: '#fff',
                border: '1px solid #eee',
                borderRadius: '12px',
              }}
            >
              <QRCodeSVG value={checkInUrl} size={220} level="H" />
            </div>

            <h4>Scan to Check In</h4>

            <p>
              QR expires in <strong>{formattedTime}</strong>
            </p>

            <div
              style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#e5e5e5',
                borderRadius: '10px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  backgroundColor: remainingSeconds <= 30 ? '#c62828' : '#111',
                }}
              />
            </div>

            <button
              onClick={generateQr}
              disabled={loading}
              style={{
                marginTop: '15px',
                padding: '10px 20px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                backgroundColor: '#fff',
                cursor: 'pointer',
              }}
            >
              Generate New QR
            </button>
          </>
        )}

        {isExpired && (
          <>
            <h4>QR Code Expired</h4>

            <p style={{ color: '#666' }}>Generate a new QR code to continue.</p>

            <button
              onClick={generateQr}
              disabled={loading}
              style={{
                padding: '12px 24px',
                backgroundColor: '#111',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Generate New QR
            </button>
          </>
        )}

        {qrMessage && <p style={{ color: '#c62828' }}>{qrMessage}</p>}
      </div>
    </div>
  );
}

function QrPageFallback() {
  return (
    <div
      style={{
        padding: '20px',
        maxWidth: '480px',
        margin: '0 auto',
        textAlign: 'center',
        color: '#666',
      }}
    >
      Loading QR check-in...
    </div>
  );
}

export default function QrPage() {
  return (
    <Suspense fallback={<QrPageFallback />}>
      <QrPageContent />
    </Suspense>
  );
}
