'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  subscribeToGateConnected,
  subscribeToGateDisconnected,
} from '../../lib/socket';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

interface GateEntry {
  gateId: string;
  socketId: string;
  connectedAt: string;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function AdminPage() {
  const [gates, setGates] = useState<GateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // ── initial fetch ──────────────────────────────────────────────
    fetch(`${API_URL}/admin/gates`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.gates || []);
        setGates(list);
        setLoading(false);
      })
      .catch((err) => {
        setError(`Failed to load gates: ${err.message}`);
        setLoading(false);
      });

    // ── real-time socket subscriptions ────────────────────────────
    const unsubConnected = subscribeToGateConnected((payload) => {
      setGates((prev) => {
        // overwrite if same gateId reconnects
        const without = prev.filter((g) => g.gateId !== payload.gateId);
        return [
          ...without,
          { gateId: payload.gateId, socketId: '', connectedAt: payload.connectedAt },
        ];
      });
    });

    const unsubDisconnected = subscribeToGateDisconnected((payload) => {
      setGates((prev) => prev.filter((g) => g.gateId !== payload.gateId));
    });

    return () => {
      unsubConnected();
      unsubDisconnected();
    };
  }, []);

  // ── styles (inline — consistent with existing pages) ────────────
  const cardStyle: React.CSSProperties = {
    padding: '20px',
    background: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
  };

  const badgeStyle: React.CSSProperties = {
    display: 'inline-block',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#22c55e',
    marginRight: '8px',
    flexShrink: 0,
  };

  const viewBtnStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '8px 16px',
    backgroundColor: '#eb0a1e',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '4px',
    fontWeight: 'bold',
    fontSize: '14px',
    flexShrink: 0,
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      {/* ── header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
        <Link href="/" style={{ color: '#eb0a1e', textDecoration: 'none', fontSize: '14px' }}>
          ← Home
        </Link>
      </div>

      <h1 style={{ color: '#eb0a1e', fontSize: '28px', marginBottom: '4px' }}>
        Admin Dashboard
      </h1>
      <p style={{ color: '#666', marginBottom: '32px', fontSize: '15px' }}>
        Connected Gates — live view (updates in real time via socket)
      </p>

      {/* ── loading / error ─────────────────────────────────────── */}
      {loading && (
        <p style={{ color: '#666' }}>Loading gates…</p>
      )}

      {error && (
        <div style={{
          padding: '16px',
          background: '#fee2e2',
          borderRadius: '8px',
          color: '#991b1b',
          marginBottom: '16px',
        }}>
          {error}
        </div>
      )}

      {/* ── gate list ───────────────────────────────────────────── */}
      {!loading && !error && gates.length === 0 && (
        <div style={{
          padding: '40px 20px',
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center',
          color: '#666',
        }}>
          <p style={{ fontSize: '18px', marginBottom: '8px' }}>No gates currently connected</p>
          <p style={{ fontSize: '14px' }}>
            Gates appear here automatically when a kiosk socket joins a gate room.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gap: '16px' }}>
        {gates.map((gate) => (
          <div key={gate.gateId} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
              <span style={badgeStyle} title="Connected" aria-label="Connected" />
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#111' }}>
                  {gate.gateId}
                </div>
                <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>
                  Connected since {formatTime(gate.connectedAt)}
                </div>
              </div>
            </div>
            <Link href={`/admin/gates/${gate.gateId}`} style={viewBtnStyle}>
              View →
            </Link>
          </div>
        ))}
      </div>

      {/* ── footer count ────────────────────────────────────────── */}
      {!loading && gates.length > 0 && (
        <p style={{ marginTop: '24px', fontSize: '13px', color: '#999' }}>
          {gates.length} gate{gates.length !== 1 ? 's' : ''} connected
        </p>
      )}
    </div>
  );
}
