'use client';

import { useEffect, useState } from 'react';
import {
  getHealth,
  HealthResponse,
  simulateLprRead,
} from '@/lib/api';
import {
  joinGateRoom,
  subscribeToCheckinDisplay,
  subscribeToSapResult,
  subscribeToGateState,
} from '@/lib/socket';
import { QRCodeSVG } from 'qrcode.react';

const QR_LIFETIME = 180;

export default function ConsolePage() {
  const [plateNo, setPlateNo] = useState('ABC-1234');
  const [gateId, setGateId] = useState('gate-1');
  const [loading, setLoading] = useState(false);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [lastSapResult, setLastSapResult] = useState<any>(null);
  const [lastGateState, setLastGateState] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const [checkInUrl, setCheckInUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [qrMessage, setQrMessage] = useState('');

  const addLog = (msg: string) => {
    setLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] ${msg}`,
      ...prev,
    ]);
  };

  // Join the selected gate room from the Console
  useEffect(() => {
    joinGateRoom(gateId, 'console');
    addLog(`Joined room gate:${gateId}`);
  }, [gateId]);

  // Health + socket subscriptions
  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((e) =>
        addLog(`Health check failed: ${e.message}`),
      );

    const unsubSap = subscribeToSapResult((data) => {
      setLastSapResult(data);

      addLog(
        `SAP Lookup: Plate=${data.plate}, Found=${data.found}`,
      );
    });

    const unsubGate = subscribeToGateState((data) => {
      setLastGateState(data);

      addLog(
        `Gate State: Opened=${data.gateOpened}, Ticket=${
          data.queueEntryId || 'N/A'
        }`,
      );
    });

    return () => {
      unsubSap();
      unsubGate();
    };
  }, []);

  // Load the kiosk URL according to the active approach
  const getUrlForApproach = (approach?: string) => {
    switch (approach?.toLowerCase()) {
      case 'voice':
        return `/kiosk?gateId=${encodeURIComponent(gateId)}`;

      // Add more mappings here as other approaches are introduced
      default:
        return null;
    }
  };

  // Open the Kiosk BEFORE triggering LPR
  const handleOpenKiosk = () => {
    const url = getUrlForApproach(
      health?.config.activeApproach,
    );

    if (!url) {
      addLog(
        `No UI available for approach "${health?.config.activeApproach}"`,
      );
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');

    addLog(
      `Opened ${url} for approach "${health?.config.activeApproach}"`,
    );
  };

  // Load the current QR display for the selected gate
  useEffect(() => {
    const loadDisplay = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

        const response = await fetch(
          `${apiUrl}/qr/display/${gateId}`,
        );

        if (!response.ok) {
          throw new Error('Failed to load QR display.');
        }

        const display = await response.json();

        if (display.checkInUrl) {
          setCheckInUrl(display.checkInUrl);
          setExpiresAt(display.expiresAt || '');

          setRemainingSeconds(
            display.expiresAt
              ? Math.max(
                  0,
                  Math.ceil(
                    (new Date(display.expiresAt).getTime() -
                      Date.now()) /
                      1000,
                  ),
                )
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
        console.error(
          '[Console] Failed to load QR display:',
          error,
        );
      }
    };

    loadDisplay();

    const unsubscribe = subscribeToCheckinDisplay(
      async (data) => {
        if (data.gateId !== gateId) {
          return;
        }

        addLog(`QR display updated for ${data.gateId}`);

        await loadDisplay();
      },
    );

    return unsubscribe;
  }, [gateId]);

  // Update QR countdown every second
  useEffect(() => {
    if (!expiresAt) {
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil(
          (new Date(expiresAt).getTime() - Date.now()) /
            1000,
        ),
      );

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

      addLog(`Generated QR ticket for ${gateId}`);
    } catch (error) {
      setQrMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong.',
      );
    } finally {
      setLoading(false);
    }
  }

  // Trigger LPR only after the Kiosk has been opened
  const handleSimulate = async () => {
    if (!plateNo.trim()) {
      return;
    }

    setLoading(true);

    try {
      await simulateLprRead(
        plateNo.trim(),
        gateId,
      );

      addLog(
        `LPR Scan triggered for ${plateNo.trim()} and gate ${gateId}`,
      );
    } catch (err: any) {
      addLog(`LPR Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const isExpired =
    checkInUrl !== '' && remainingSeconds === 0;

  const minutes = Math.floor(
    remainingSeconds / 60,
  );

  const seconds = remainingSeconds % 60;

  const formattedTime = `${String(minutes).padStart(
    2,
    '0',
  )}:${String(seconds).padStart(2, '0')}`;

  const progress =
    (remainingSeconds / QR_LIFETIME) * 100;

  return (
    <div
      style={{
        padding: '20px',
        maxWidth: '1100px',
        margin: '0 auto',
      }}
    >
      <h1 style={{ color: '#eb0a1e' }}>
        Toyota Service Center Console
      </h1>

      {health && (
        <div
          style={{
            background: '#eef6ff',
            padding: '10px',
            borderRadius: '6px',
            marginBottom: '15px',
          }}
        >
          <strong>Config:</strong>{' '}
          ACTIVE_APPROACH ={' '}
          <strong>
            {health.config.activeApproach.toUpperCase()}
          </strong>{' '}
          | SAP = {health.config.adapters.sap}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
        }}
      >
        {/* LPR / Gate Console */}
        <div
          style={{
            background: '#fff',
            padding: '16px',
            borderRadius: '8px',
            boxShadow:
              '0 2px 6px rgba(0,0,0,0.1)',
          }}
        >
          <h3>Simulate Plate Reader</h3>

          <label>Plate Number:</label>

          <input
            type="text"
            value={plateNo}
            onChange={(e) =>
              setPlateNo(e.target.value)
            }
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '10px',
            }}
          />

          <label>Gate ID:</label>

          <select
            value={gateId}
            onChange={(e) =>
              setGateId(e.target.value)
            }
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '15px',
            }}
          >
            <option value="gate-1">Gate 1</option>
            <option value="gate-2">Gate 2</option>
          </select>

          {/* Open Kiosk first */}
          <button
            onClick={handleOpenKiosk}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#333',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              marginBottom: '10px',
              cursor: 'pointer',
            }}
          >
            Open Kiosk
          </button>

          {/* Trigger LPR second */}
          <button
            onClick={handleSimulate}
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#eb0a1e',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: loading
                ? 'not-allowed'
                : 'pointer',
            }}
          >
            {loading
              ? 'Simulating...'
              : 'Simulate LPR Read'}
          </button>
        </div>

        {/* QR Console */}
        <div
          style={{
            background: '#fff',
            padding: '16px',
            borderRadius: '8px',
            boxShadow:
              '0 2px 6px rgba(0,0,0,0.1)',
            textAlign: 'center',
          }}
        >
          <h3>QR Check-in</h3>

          {!checkInUrl && (
            <>
              <p style={{ color: '#666' }}>
                Generate a QR code for the customer.
              </p>

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
                {loading
                  ? 'Generating...'
                  : 'Generate QR Code'}
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
                <QRCodeSVG
                  value={checkInUrl}
                  size={220}
                  level="H"
                />
              </div>

              <h4>Scan to Check In</h4>

              <p>
                QR expires in{' '}
                <strong>
                  {formattedTime}
                </strong>
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
                    backgroundColor:
                      remainingSeconds <= 30
                        ? '#c62828'
                        : '#111',
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

              <p style={{ color: '#666' }}>
                Generate a new QR code to continue.
              </p>

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

          {qrMessage && (
            <p style={{ color: '#c62828' }}>
              {qrMessage}
            </p>
          )}
        </div>
      </div>

      {/* Live Gate Room */}
      <div
        style={{
          marginTop: '20px',
          background: '#fff',
          padding: '16px',
          borderRadius: '8px',
          boxShadow:
            '0 2px 6px rgba(0,0,0,0.1)',
        }}
      >
        <h3>Live Gate Room Status</h3>

        <p>
          <strong>Room:</strong>{' '}
          <code>gate:{gateId}</code>
        </p>

        <div>
          <strong>SAP Lookup:</strong>

          {lastSapResult ? (
            <div
              style={{
                background: '#f0f0f0',
                padding: '8px',
                marginTop: '4px',
              }}
            >
              Plate: {lastSapResult.plate} |
              Name:{' '}
              {lastSapResult.profile?.name ||
                'Unknown'}
            </div>
          ) : (
            <div>Waiting for scan...</div>
          )}
        </div>

        <div style={{ marginTop: '10px' }}>
          <strong>Gate Status:</strong>

          {lastGateState ? (
            <div
              style={{
                background:
                  lastGateState.gateOpened
                    ? '#28a745'
                    : '#dc3545',
                color: '#fff',
                padding: '10px',
                marginTop: '4px',
                textAlign: 'center',
              }}
            >
              {lastGateState.gateOpened
                ? 'GATE OPENED'
                : 'GATE CLOSED'}

              {lastGateState.queueEntryId && (
                <div>
                  Ticket:{' '}
                  {lastGateState.queueEntryId}
                </div>
              )}
            </div>
          ) : (
            <div>No decision yet</div>
          )}
        </div>
      </div>

      {/* Activity Stream */}
      <div
        style={{
          marginTop: '20px',
          background: '#222',
          color: '#0f0',
          padding: '10px',
          borderRadius: '6px',
          fontFamily: 'monospace',
          maxHeight: '150px',
          overflowY: 'auto',
        }}
      >
        <strong>Activity Stream:</strong>

        {logs.map((log, index) => (
          <div key={index}>{log}</div>
        ))}
      </div>
    </div>
  );
}