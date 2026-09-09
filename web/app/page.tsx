import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ color: '#eb0a1e', fontSize: '32px' }}>Toyota Voice & QR Kiosk MVP</h1>
      <p style={{ color: '#333', fontSize: '18px' }}>
        Welcome to the Toyota Service Center Kiosk / Queue management simulator.
      </p>

      <div style={{ marginTop: '30px', display: 'grid', gap: '20px' }}>
        <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2>Developer Console (LPR Simulation)</h2>
          <p>Simulate plate scans, test live socket room connectivity, SAP lookup, and gate opening decisions.</p>
          <Link
            href="/console"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: '#eb0a1e',
              color: '#fff',
              textDecoration: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
            }}
          >
            Open Developer Console &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
