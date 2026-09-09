'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import CheckinForm from './CheckinForm';

function CheckinContent() {
  const searchParams = useSearchParams();

  const token = searchParams.get('t');
  const gateId = searchParams.get('gate') || 'gate-1';

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(135deg, #f4f6f8 0%, #ffffff 100%)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '24px 16px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          padding: '32px 24px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.08)',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            marginBottom: '30px',
          }}
        >
          <div
            style={{
              fontSize: '13px',
              fontWeight: '700',
              letterSpacing: '2px',
              color: '#555',
              marginBottom: '8px',
            }}
          >
            TOYOTA
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: '28px',
              color: '#111',
            }}
          >
            Service Center
          </h1>

          <p
            style={{
              marginTop: '10px',
              color: '#666',
              fontSize: '15px',
            }}
          >
            Welcome! Complete your check-in below.
          </p>
        </div>

        {!token ? (
          <div
            style={{
              textAlign: 'center',
              padding: '24px',
              backgroundColor: '#f8f8f8',
              borderRadius: '14px',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: '20px',
                color: '#222',
              }}
            >
              Invalid QR Code
            </h2>

            <p
              style={{
                marginTop: '10px',
                marginBottom: 0,
                color: '#666',
                fontSize: '14px',
              }}
            >
              Please scan a valid QR code from the service center kiosk.
            </p>
          </div>
        ) : (
          <CheckinForm token={token} gateId={gateId} />
        )}
      </div>
    </main>
  );
}

export default function CheckinPageClient() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontFamily: 'Arial, sans-serif',
          }}
        >
          Loading check-in...
        </main>
      }
    >
      <CheckinContent />
    </Suspense>
  );
}