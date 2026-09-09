'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const QR_LIFETIME = 180;

export default function ConsolePage() {
  const [checkInUrl, setCheckInUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(0);

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
      setExpiresAt(data.expiresAt);
      setRemainingSeconds(data.expiresIn);
      setMessage('');
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

  useEffect(() => {
    if (!expiresAt) {
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil(
          (new Date(expiresAt).getTime() - Date.now()) / 1000,
        ),
      );

      setRemainingSeconds(remaining);

      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const isExpired =
    checkInUrl !== '' && remainingSeconds === 0;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(
    seconds,
  ).padStart(2, '0')}`;

  const progress =
    (remainingSeconds / QR_LIFETIME) * 100;

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(135deg, #f4f6f8 0%, #ffffff 100%)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '32px 20px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '620px',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          padding: '40px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.08)',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: '32px' }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: '700',
              letterSpacing: '2px',
              color: '#555',
              marginBottom: '10px',
            }}
          >
            TOYOTA
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: '32px',
              color: '#111',
            }}
          >
            Service Center
          </h1>

          <p
            style={{
              marginTop: '12px',
              color: '#666',
              fontSize: '18px',
            }}
          >
            Scan to Check In
          </p>
        </div>

        {!checkInUrl && (
          <div style={{ padding: '30px 0' }}>
            <p
              style={{
                color: '#666',
                marginBottom: '24px',
                fontSize: '16px',
              }}
            >
              Generate a QR code for the customer to start
              check-in.
            </p>

            <button
              onClick={generateQr}
              disabled={loading}
              style={{
                padding: '15px 32px',
                border: 'none',
                borderRadius: '10px',
                backgroundColor: '#111',
                color: '#fff',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Generating...' : 'Generate QR Code'}
            </button>
          </div>
        )}

        {checkInUrl && !isExpired && (
          <>
            <div
              style={{
                display: 'inline-flex',
                padding: '24px',
                backgroundColor: '#fff',
                borderRadius: '20px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                border: '1px solid #eee',
              }}
            >
              <QRCodeSVG
                value={checkInUrl}
                size={280}
                level="H"
              />
            </div>

            <h2
              style={{
                marginTop: '28px',
                marginBottom: '8px',
                fontSize: '22px',
                color: '#111',
              }}
            >
              Scan this QR code
            </h2>

            <p
              style={{
                margin: 0,
                color: '#666',
                fontSize: '15px',
              }}
            >
              Use your phone to continue check-in.
            </p>

            <div style={{ marginTop: '28px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <span
                  style={{
                    fontSize: '14px',
                    color: '#666',
                  }}
                >
                  QR expires in
                </span>

                <strong
                  style={{
                    fontSize: '20px',
                    color:
                      remainingSeconds <= 30
                        ? '#c62828'
                        : '#111',
                  }}
                >
                  {formattedTime}
                </strong>
              </div>

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
                    backgroundColor:
                      remainingSeconds <= 30
                        ? '#c62828'
                        : '#111',
                    transition: 'width 1s linear',
                  }}
                />
              </div>
            </div>

            <button
              onClick={generateQr}
              disabled={loading}
              style={{
                marginTop: '28px',
                padding: '12px 24px',
                border: '1px solid #ddd',
                borderRadius: '10px',
                backgroundColor: '#fff',
                color: '#111',
                fontSize: '15px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Generating...' : 'Generate New QR'}
            </button>

            <p
              style={{
                marginTop: '20px',
                fontSize: '11px',
                color: '#999',
                wordBreak: 'break-all',
              }}
            >
              {checkInUrl}
            </p>
          </>
        )}

        {isExpired && (
          <div style={{ padding: '30px 0' }}>
            <div
              style={{
                width: '90px',
                height: '90px',
                margin: '0 auto 24px',
                borderRadius: '50%',
                backgroundColor: '#f5f5f5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '42px',
              }}
            >
              !
            </div>

            <h2
              style={{
                margin: 0,
                fontSize: '26px',
                color: '#222',
              }}
            >
              QR Code Expired
            </h2>

            <p
              style={{
                marginTop: '12px',
                color: '#666',
                fontSize: '16px',
              }}
            >
              Generate a new QR code to continue.
            </p>

            <button
              onClick={generateQr}
              disabled={loading}
              style={{
                marginTop: '24px',
                padding: '15px 32px',
                border: 'none',
                borderRadius: '10px',
                backgroundColor: '#111',
                color: '#fff',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Generating...' : 'Generate New QR'}
            </button>
          </div>
        )}

        {message && (
          <p
            style={{
              marginTop: '20px',
              color: '#c62828',
              fontSize: '14px',
            }}
          >
            {message}
          </p>
        )}
      </div>
    </main>
  );
}