'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import CheckinForm from '@/features/checkin/CheckinForm';

function CheckinContent() {
  const searchParams = useSearchParams();

  const token = searchParams.get('t');
  const gateId = searchParams.get('gate');

  if (!token || !gateId) {
    return (
      <main
        style={{
          maxWidth: '500px',
          margin: '60px auto',
          padding: '20px',
        }}
      >
        <h2>Invalid Check-in QR</h2>

        <p>
          This QR code is missing the required check-in
          information.
        </p>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: '500px',
        margin: '40px auto',
        padding: '20px',
      }}
    >
      <h1
        style={{
          textAlign: 'center',
          marginBottom: '10px',
        }}
      >
        Toyota Service Center
      </h1>

      <p
        style={{
          textAlign: 'center',
          color: '#666',
          marginBottom: '30px',
        }}
      >
        Complete your check-in
      </p>

      <CheckinForm
        token={token}
        gateId={gateId}
      />
    </main>
  );
}

export default function CheckinPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            maxWidth: '500px',
            margin: '60px auto',
            padding: '20px',
            textAlign: 'center',
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