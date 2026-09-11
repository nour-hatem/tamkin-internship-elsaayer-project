'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { KioskAvatar, type AvatarState } from '../../components/KioskAvatar';
import { joinGateRoom, subscribeToSendGreeting } from '../../lib/socket';

interface SendGreetingPayload {
  sessionId: string;
  state: string;
  message: string;
  audio: any;
  gateId: string;
}

function KioskContent() {
  const searchParams = useSearchParams();
  const gateId = searchParams.get('gateId') || 'gate-1';

  const [state, setState] = useState<AvatarState>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const cleanupAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
      currentAudioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  };

  // --------------------------------------------------
  // Unlock browser audio after user interaction
  // --------------------------------------------------
  const unlockAudio = async () => {
    try {
      const audio = new Audio();

      audio.muted = true;

      await audio.play();
      audio.pause();

      setAudioUnlocked(true);

      console.log('[Kiosk] Audio unlocked successfully');
    } catch (error) {
      console.error('[Kiosk] Failed to unlock audio:', error);
    }
  };

  useEffect(() => {
    console.log(`[Kiosk] Initializing Kiosk for gate: ${gateId}`);

    // Subscribe FIRST
    const unsubscribe = subscribeToSendGreeting(
      (payload: SendGreetingPayload) => {
        console.log('[Kiosk] Received SEND_GREETING', payload);
        console.log('[Kiosk] audio:', payload.audio);
        console.log('[Kiosk] audio type:', typeof payload.audio);
        console.log(
          '[Kiosk] audio instanceof ArrayBuffer:',
          payload.audio instanceof ArrayBuffer,
        );
        console.log(
          '[Kiosk] audio byteLength:',
          payload.audio?.byteLength,
        );
        console.log(
          '[Kiosk] audio data length:',
          payload.audio?.data?.length,
        );

        if (payload.sessionId) {
          setSessionId(payload.sessionId);
        }

        if (payload.message) {
          setMessage(payload.message);
        }

        cleanupAudio();

        if (!payload.audio) {
          console.warn('[Kiosk] No audio received');
          setState('listening');
          return;
        }

        // --------------------------------------------------
        // Convert audio binary to ArrayBuffer
        // --------------------------------------------------
        let arrayBuffer: ArrayBuffer | null = null;

        if (payload.audio instanceof ArrayBuffer) {
          arrayBuffer = payload.audio;
        } else if (ArrayBuffer.isView(payload.audio)) {
          const view = payload.audio as Uint8Array;

          arrayBuffer = view.buffer.slice(
            view.byteOffset,
            view.byteOffset + view.byteLength,
          ) as ArrayBuffer;
        } else if (
          payload.audio?.type === 'Buffer' &&
          Array.isArray(payload.audio.data)
        ) {
          arrayBuffer = new Uint8Array(payload.audio.data).buffer;
        } else if (Array.isArray(payload.audio)) {
          arrayBuffer = new Uint8Array(payload.audio).buffer;
        }

        if (!arrayBuffer) {
          console.warn(
            '[Kiosk] Could not parse audio buffer from payload',
          );

          setState('listening');
          return;
        }

        console.log(
          '[Kiosk] Creating audio blob. Bytes:',
          arrayBuffer.byteLength,
        );

        // --------------------------------------------------
        // Create audio
        // --------------------------------------------------
        const blob = new Blob([arrayBuffer], {
          type: 'audio/mpeg',
        });

        const objectUrl = URL.createObjectURL(blob);

        audioUrlRef.current = objectUrl;

        const audio = new Audio(objectUrl);

        currentAudioRef.current = audio;

        // --------------------------------------------------
        // Audio actually started
        // --------------------------------------------------
        audio.onplay = () => {
          console.log('[Kiosk] Audio started playing');

          // Only NOW show talking
          setState('talking');
        };

        // --------------------------------------------------
        // Audio finished
        // --------------------------------------------------
        audio.onended = () => {
          console.log('[Kiosk] Audio ended');

          cleanupAudio();

          // Now the user can answer
          setState('listening');
        };

        // --------------------------------------------------
        // Audio error
        // --------------------------------------------------
        audio.onerror = (event) => {
          console.error('[Kiosk] Audio playback error:', event);

          cleanupAudio();

          setState('listening');
        };

        // --------------------------------------------------
        // Audio metadata
        // --------------------------------------------------
        audio.onloadedmetadata = () => {
          console.log(
            '[Kiosk] Audio duration:',
            audio.duration,
            'seconds',
          );
        };

        // --------------------------------------------------
        // Play
        // --------------------------------------------------
        audio
          .play()
          .then(() => {
            console.log('[Kiosk] audio.play() succeeded');
          })
          .catch((err) => {
            console.error(
              '[Kiosk] Failed to play audio automatically:',
              err,
            );

            cleanupAudio();

            setState('listening');
          });
      },
    );

    // Join AFTER subscribing
    joinGateRoom(gateId);

    return () => {
      unsubscribe();
      cleanupAudio();
    };
  }, [gateId]);

  const handleChoice = (choice: 'yes' | 'no') => {
    console.log(
      `[Kiosk] User selected answer: ${choice} for session: ${sessionId}`,
    );
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        background: '#0c0a14',
        color: '#f5f0e8',
        fontFamily: 'system-ui, sans-serif',
        padding: '24px',
        position: 'relative',
      }}
    >
      <KioskAvatar state={state} size={340} />

      {message && (
        <div
          style={{
            maxWidth: 500,
            width: '100%',
            padding: '16px 24px',
            borderRadius: 16,
            background: '#1c1530',
            border: '1px solid #3d2f5c',
            textAlign: 'center',
            fontSize: 18,
            lineHeight: 1.5,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            direction: 'rtl',
          }}
        >
          {message}
        </div>
      )}

      {state === 'listening' && (
        <div style={{ display: 'flex', gap: 16 }}>
          <button
            onClick={() => handleChoice('yes')}
            style={{
              padding: '12px 32px',
              borderRadius: 999,
              border: 'none',
              background: '#2e7d32',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: 18,
              fontWeight: 'bold',
            }}
          >
            نعم
          </button>

          <button
            onClick={() => handleChoice('no')}
            style={{
              padding: '12px 32px',
              borderRadius: 999,
              border: 'none',
              background: '#c62828',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: 18,
              fontWeight: 'bold',
            }}
          >
            لا
          </button>
        </div>
      )}

      
     {/* Audio unlock overlay */}
{!audioUnlocked && state === 'idle' && (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: '#0c0a14',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      zIndex: 100,
    }}
  >
    <div
      style={{
        fontSize: 22,
        textAlign: 'center',
        direction: 'rtl',
      }}
    >
      اضغط لبدء الكشك
    </div>

    <button
      onClick={unlockAudio}
      style={{
        padding: '14px 36px',
        borderRadius: 999,
        border: 'none',
        background: '#6fd6c6',
        color: '#14121f',
        cursor: 'pointer',
        fontSize: 18,
        fontWeight: 'bold',
      }}
    >
      Start Kiosk
    </button>
  </div>
)}
    
    </main>
  );
}

export default function KioskPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            background: '#0c0a14',
            color: '#f5f0e8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          Loading Kiosk...
        </div>
      }
    >
      <KioskContent />
    </Suspense>
  );
}