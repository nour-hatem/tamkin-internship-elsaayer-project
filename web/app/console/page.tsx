'use client';

import { useState, useEffect } from 'react';
import { simulateLprRead, getHealth, HealthResponse } from '@/lib/api';
import {
  joinGateRoom,
  subscribeToSapResult,
  subscribeToGateState,
} from '@/lib/socket';

export default function ConsolePage() {
  const [plateNo, setPlateNo] = useState('ABC-1234');
  const [gateId, setGateId] = useState('gate-1');
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [lastSapResult, setLastSapResult] = useState<any>(null);
  const [lastGateState, setLastGateState] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) =>
    setLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] ${msg}`,
      ...prev,
    ]);

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

  const getUrlForApproach = (approach?: string) => {
    switch (approach?.toLowerCase()) {
        return `/kiosk?gateId=${encodeURIComponent(gateId)}`;

      // Add more mappings here as other approaches are introduced
      default:
        return null;
    }
  };

  // Open the Kiosk BEFORE triggering LPR
  const handleOpenKiosk = () => {
    const url = getUrlForApproach(health?.config.activeApproach);

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

  // Trigger LPR only after the Kiosk has been opened
  const handleSimulate = async () => {
    if (!plateNo.trim()) return;

    setLoading(true);

    try {
      await simulateLprRead(plateNo.trim(), gateId);

      addLog(
        `LPR Scan triggered for ${plateNo.trim()} and gate ${gateId}`,
      );
    } catch (err: any) {
      addLog(`LPR Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: '20px',
        maxWidth: '850px',
        margin: '0 auto',
      }}
    >
      <h1 style={{ color: '#eb0a1e' }}>LPR Developer Console</h1>

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
          <strong>{health.config.activeApproach.toUpperCase()}</strong>{' '}
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
        {/* Controls */}
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
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Simulating...' : 'Simulate LPR Read'}
          </button>
        </div>

        {/* Live Gate Room Status */}
        <div
          style={{
            background: '#fff',
            padding: '16px',
            borderRadius: '8px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
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
                Plate: {lastSapResult.plate} | Name:{' '}
                {lastSapResult.profile?.name || 'Unknown'}
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
                  background: lastGateState.gateOpened
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
                    Ticket: {lastGateState.queueEntryId}
                  </div>
                )}
              </div>
            ) : (
              <div>No decision yet</div>
            )}
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

        {logs.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}