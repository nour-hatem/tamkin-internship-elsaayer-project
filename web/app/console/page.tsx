'use client';

import { useEffect, useState, useRef } from 'react';
import { getHealth, HealthResponse, simulateLprRead } from '@/lib/api';
import {
  joinGateRoom,
  subscribeToSapResult,
  subscribeToGateState,
} from '@/lib/socket';

const GATE_RESET_DELAY_MS = 3000; // how long the gate stays "open" before auto-resetting

export default function ConsolePage() {
  const [plateNo, setPlateNo] = useState('ABC-1234');
  const [gateId, setGateId] = useState('gate-1');
  const [loading, setLoading] = useState(false);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [lastSapResult, setLastSapResult] = useState<any>(null);
  const [lastGateState, setLastGateState] = useState<any>({ gateOpened: false });
  const [logs, setLogs] = useState<string[]>([]);

  const gateResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addLog = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
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
      .catch((e) => addLog(`Health check failed: ${e.message}`));

    const unsubSap = subscribeToSapResult((data) => {
      setLastSapResult(data);

      addLog(`SAP Lookup: Plate=${data.plate}, Found=${data.found}`);
    });

    const unsubGate = subscribeToGateState((data) => {
      setLastGateState(data);

      addLog(`Gate State: Opened=${data.gateOpened}, Ticket=${data.queueEntryId || 'N/A'}`);

      // Clear any pending reset from a previous scan so overlapping
      // events don't stack up or reset prematurely.
      if (gateResetTimer.current) {
        clearTimeout(gateResetTimer.current);
        gateResetTimer.current = null;
      }

      if (data.gateOpened) {
        gateResetTimer.current = setTimeout(() => {
          setLastSapResult(null);
          setLastGateState({ gateOpened: false });
          addLog('Gate auto-closed, ready for next scan');
          gateResetTimer.current = null;
        }, GATE_RESET_DELAY_MS);
      }
    });

    return () => {
      unsubSap();
      unsubGate();

      if (gateResetTimer.current) {
        clearTimeout(gateResetTimer.current);
      }
    };
  }, []);

  // Map the active approach to the UI that should be opened for it
  const getUrlForApproach = (approach?: string) => {
    switch (approach?.toLowerCase()) {
      case 'voice':
        return `/kiosk?gateId=${encodeURIComponent(gateId)}`;

      case 'qr':
        return `/qr?gateId=${encodeURIComponent(gateId)}`;

      // Add more mappings here as other approaches are introduced
      default:
        return null;
    }
  };

  // Open the Kiosk BEFORE triggering LPR
  const handleOpenKiosk = () => {
    const url = getUrlForApproach(health?.config.activeApproach);

    if (!url) {
      addLog(`No UI available for approach "${health?.config.activeApproach}"`);
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');

    addLog(`Opened ${url} for approach "${health?.config.activeApproach}"`);
  };

  // Open the QR check-in page, only valid when ACTIVE_APPROACH is "qr"
  const handleOpenQr = () => {
    if (health?.config.activeApproach?.toLowerCase() !== 'qr') {
      addLog(`QR UI is not available for approach "${health?.config.activeApproach}"`);
      return;
    }

    const url = `/qr?gateId=${encodeURIComponent(gateId)}`;

    window.open(url, '_blank', 'noopener,noreferrer');

    addLog(`Opened ${url} for approach "qr"`);
  };

  // Trigger LPR only after the Kiosk/QR page has been opened
  const handleSimulate = async () => {
    if (!plateNo.trim()) {
      return;
    }

    setLoading(true);

    try {
      await simulateLprRead(plateNo.trim(), gateId);

      addLog(`LPR Scan triggered for ${plateNo.trim()} and gate ${gateId}`);
    } catch (err: any) {
      addLog(`LPR Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const isQrApproach = health?.config.activeApproach?.toLowerCase() === 'qr';

  return (
    <div
      style={{
        padding: '20px',
        maxWidth: '1100px',
        margin: '0 auto',
      }}
    >
      <h1 style={{ color: '#eb0a1e' }}>Toyota Service Center Console</h1>

      {health && (
        <div
          style={{
            background: '#eef6ff',
            padding: '10px',
            borderRadius: '6px',
            marginBottom: '15px',
          }}
        >
          <strong>Config:</strong> ACTIVE_APPROACH ={' '}
          <strong>{health.config.activeApproach.toUpperCase()}</strong> | SAP ={' '}
          {health.config.adapters.sap}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '20px',
          maxWidth: '520px',
        }}
      >
        {/* LPR / Gate Console */}
        <div
          style={{
            background: '#fff',
            padding: '16px',
            borderRadius: '8px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          }}
        >
          <h3>Simulate Plate Reader</h3>

          <label>Plate Number:</label>

          <input
            type="text"
            value={plateNo}
            onChange={(e) => setPlateNo(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '10px',
            }}
          />

          <label>Gate ID:</label>

          <select
            value={gateId}
            onChange={(e) => setGateId(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '15px',
            }}
          >
            <option value="gate-1">Gate 1</option>
            <option value="gate-2">Gate 2</option>
          </select>

          {/* Open Kiosk first (voice approach) */}
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

          {/* Open QR check-in (qr approach) */}
          <button
            onClick={handleOpenQr}
            disabled={!isQrApproach}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: isQrApproach ? '#111' : '#999',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              marginBottom: '10px',
              cursor: isQrApproach ? 'pointer' : 'not-allowed',
            }}
          >
            Open QR
          </button>

          {/* Trigger LPR last */}
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
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Simulating...' : 'Simulate LPR Read'}
          </button>
        </div>
      </div>

      {/* Live Gate Room */}
      <div
        style={{
          marginTop: '20px',
          background: '#fff',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
        }}
      >
        <h3>Live Gate Room Status</h3>

        <p>
          <strong>Room:</strong> <code>gate:{gateId}</code>
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
              Plate: {lastSapResult.plate} | Name: {lastSapResult.profile?.name || 'Unknown'}
            </div>
          ) : (
            <div>Waiting for scan...</div>
          )}
        </div>

        <div style={{ marginTop: '10px' }}>
          <strong>Gate Status:</strong>

          <div
            style={{
              background: lastGateState.gateOpened ? '#28a745' : '#dc3545',
              color: '#fff',
              padding: '10px',
              marginTop: '4px',
              textAlign: 'center',
            }}
          >
            {lastGateState.gateOpened ? 'GATE OPENED' : 'GATE CLOSED'}

            {lastGateState.queueEntryId && <div>Ticket: {lastGateState.queueEntryId}</div>}
          </div>
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
