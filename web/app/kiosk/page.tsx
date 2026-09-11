'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  joinGateRoom,
  subscribeToSendGreeting,
  emitConfirmingPhone,
} from '../../lib/socket';
import { KioskAvatar, type AvatarState } from '../../components/KioskAvatar';

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
  const [isRecording, setIsRecording] = useState(false);

  // --------------------------------------------------
  // Audio refs
  // --------------------------------------------------

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // --------------------------------------------------
  // Recording refs
  // --------------------------------------------------

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const maxRecordTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const noSpeechTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const sessionIdRef = useRef<string | null>(null);

  // Keep the latest sessionId available inside async callbacks.
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // --------------------------------------------------
  // Clean up recording resources
  // --------------------------------------------------

  const cleanupRecording = () => {
    // Cancel VAD animation frame
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Clear fallback timers
    if (maxRecordTimeoutRef.current !== null) {
      clearTimeout(maxRecordTimeoutRef.current);
      maxRecordTimeoutRef.current = null;
    }

    if (noSpeechTimeoutRef.current !== null) {
      clearTimeout(noSpeechTimeoutRef.current);
      noSpeechTimeoutRef.current = null;
    }

    // Stop microphone tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
          console.log('[Kiosk] Stopped stream track:', track.label);
        } catch (error) {
          console.error('[Kiosk] Error stopping stream track:', error);
        }
      });

      mediaStreamRef.current = null;
    }

    // Close AudioContext
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch((error) => {
          console.error('[Kiosk] Error closing AudioContext:', error);
        });
      }

      audioContextRef.current = null;
    }
  };

  // --------------------------------------------------
  // Stop recording
  // --------------------------------------------------

const stopRecording = () => {
  console.log('[Kiosk] stopRecording() requested');

  if (maxRecordTimeoutRef.current !== null) {
    console.log('[Kiosk] Clearing max recording timeout');
    clearTimeout(maxRecordTimeoutRef.current);
    maxRecordTimeoutRef.current = null;
  }

  const recorder = mediaRecorderRef.current;

  if (!recorder) {
    cleanupRecording();
    setIsRecording(false);
    return;
  }

  if (recorder.state !== 'inactive') {
    try {
      recorder.stop();
    } catch (error) {
      console.error('[Kiosk] Error stopping MediaRecorder:', error);
    }
  }

  setIsRecording(false);
};

  // --------------------------------------------------
  // Clean up currently playing TTS audio
  // --------------------------------------------------

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
  // Start microphone recording
  // --------------------------------------------------

  const startRecording = async () => {
    // Prevent duplicate recordings
    if (mediaRecorderRef.current?.state === 'recording') {
      console.log('[Kiosk] Recording already in progress.');
      return;
    }

    try {
      console.log('[Kiosk] Starting microphone recording...');

      cleanupRecording();

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia is not supported in this browser');
      }

      if (typeof MediaRecorder === 'undefined') {
        throw new Error('MediaRecorder API is not supported in this browser');
      }

      // --------------------------------------------------
      // Request microphone
      // --------------------------------------------------

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      mediaStreamRef.current = stream;

      // --------------------------------------------------
      // Choose supported recording format
      // --------------------------------------------------

      let mimeType = '';

      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      }

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];

      // --------------------------------------------------
      // Collect recorded audio
      // --------------------------------------------------

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      // --------------------------------------------------
      // Recording finished
      // --------------------------------------------------

      mediaRecorder.onstop = async () => {
        console.log('[Kiosk] MediaRecorder stopped');

        const recordedMimeType =
          mediaRecorder.mimeType || mimeType || 'audio/webm';

        const audioBlob = new Blob(chunks, {
          type: recordedMimeType,
        });

        console.log(
          '[Kiosk] Recorded audio size:',
          audioBlob.size,
          'bytes',
        );

        try {
          const arrayBuffer = await audioBlob.arrayBuffer();

          console.log(
            '[Kiosk] Audio ArrayBuffer created:',
            arrayBuffer.byteLength,
            'bytes',
          );

          const currentSessionId = sessionIdRef.current;

          if (!currentSessionId) {
            console.warn(
              '[Kiosk] Cannot emit confirming.phone: sessionId is missing',
            );

            setState('idle');
            cleanupRecording();
            mediaRecorderRef.current = null;
            return;
          }

          // --------------------------------------------------
          // Send recording to backend
          //
          // Frontend does NOT decide YES/NO.
          // Backend will perform STT + NLU.
          // --------------------------------------------------

          console.log(
            '[Kiosk] Emitting confirming.phone event...',
          );

          emitConfirmingPhone({
            sessionId: currentSessionId,
            gateId,
            audio: arrayBuffer,
          });

          console.log(
            '[Kiosk] confirming.phone emitted successfully',
          );
        } catch (error) {
          console.error(
            '[Kiosk] Error processing recorded audio:',
            error,
          );
        } finally {
          mediaRecorderRef.current = null;

          cleanupRecording();

          setIsRecording(false);

          // Wait for backend response before changing the
          // business state later.
          setState('idle');
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error(
          '[Kiosk] MediaRecorder error:',
          event,
        );

        mediaRecorderRef.current = null;

        setIsRecording(false);
        cleanupRecording();
        setState('idle');
      };

      // --------------------------------------------------
      // Start recording
      // --------------------------------------------------

      mediaRecorder.start();

      setIsRecording(true);
      setState('listening');

      console.log('[Kiosk] Recording started.');

      // --------------------------------------------------
      // Voice Activity Detection
      // --------------------------------------------------

      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }).webkitAudioContext;

      if (!AudioContextClass) {
        console.warn(
          '[Kiosk] AudioContext is not supported.',
        );

        // Fallback: stop after 6 seconds.
        maxRecordTimeoutRef.current = setTimeout(() => {
          console.log(
            '[Kiosk] Fixed recording timeout reached.',
          );

          stopRecording();
        }, 6000);

        return;
      }

      const audioContext = new AudioContextClass();

      audioContextRef.current = audioContext;

      const source =
        audioContext.createMediaStreamSource(stream);

      const analyser =
        audioContext.createAnalyser();

      analyser.fftSize = 512;

      const bufferLength = analyser.fftSize;

      const dataArray =
        new Float32Array(bufferLength);

      source.connect(analyser);

      // --------------------------------------------------
      // VAD configuration
      // --------------------------------------------------

      const SPEAKING_THRESHOLD = 0.2;
      const SILENCE_THRESHOLD = 0.15;

      // Customer must be silent for ~1.8 seconds.
      const SILENCE_DURATION = 1800;

      // Maximum total recording duration.
      const MAX_RECORD_TIME = 15000;

      // If customer says nothing for 7 seconds.
      const NO_SPEECH_TIMEOUT = 7000;

      const startTime = Date.now();

      let hasSpoken = false;
      let silenceStart: number | null = null;

      // --------------------------------------------------
      // VAD loop
      // --------------------------------------------------

      const checkSilence = () => {
        const recorder = mediaRecorderRef.current;

        if (!recorder || recorder.state === 'inactive') {
          return;
        }

        analyser.getFloatTimeDomainData(dataArray);

        let sumSquares = 0;

        for (let i = 0; i < dataArray.length; i++) {
          sumSquares += dataArray[i] * dataArray[i];
          
        }

        const rms = Math.sqrt(
          sumSquares / dataArray.length,
        );

        const elapsed = Date.now() - startTime;

        // --------------------------------------------------
        // Maximum recording duration
        // --------------------------------------------------

        if (elapsed >= MAX_RECORD_TIME) {
          console.log(
            '[Kiosk] Maximum recording time reached.',
          );

          stopRecording();
          return;
        }

        // --------------------------------------------------
        // Waiting for customer to start speaking
        // --------------------------------------------------

        if (!hasSpoken) {
          if (
            rms > SPEAKING_THRESHOLD &&
            elapsed > 300
          ) {
            hasSpoken = true;

            console.log(
              '[Kiosk] Speech detected. RMS:',
              rms.toFixed(4),
            );
          } else if (
            elapsed >= NO_SPEECH_TIMEOUT
          ) {
            console.log(
              '[Kiosk] No speech detected. Stopping.',
            );

            stopRecording();
            return;
          }
        }

        // --------------------------------------------------
        // Customer has spoken.
        // Now detect silence.
        // --------------------------------------------------

        else {
          if (rms < SILENCE_THRESHOLD) {
            if (silenceStart === null) {
              silenceStart = Date.now();
            } else if (
              Date.now() - silenceStart >=
              SILENCE_DURATION
            ) {
              console.log(
                '[Kiosk] Silence duration reached. Stopping.',
              );

              stopRecording();
              return;
            }
          } else {
            // Customer started speaking again.
            silenceStart = null;
          }
        }

        animationFrameRef.current =
          requestAnimationFrame(checkSilence);
      };

      animationFrameRef.current =
        requestAnimationFrame(checkSilence);

    } catch (error) {
      console.error(
        '[Kiosk] Failed to start microphone recording:',
        error,
      );

      setIsRecording(false);
      setState('idle');

      cleanupRecording();
      mediaRecorderRef.current = null;
    }
  };

  // --------------------------------------------------
  // Unlock browser audio
  // --------------------------------------------------

  const unlockAudio = async () => {
    try {
      const audio = new Audio();

      audio.muted = true;

      await audio.play();

      audio.pause();

      setAudioUnlocked(true);

      console.log(
        '[Kiosk] Audio unlocked successfully',
      );
    } catch (error) {
      console.error(
        '[Kiosk] Failed to unlock audio:',
        error,
      );
    }
  };

  // --------------------------------------------------
  // Receive greeting from backend
  // --------------------------------------------------

  useEffect(() => {
    console.log(
      `[Kiosk] Initializing Kiosk for gate: ${gateId}`,
    );

    // IMPORTANT:
    // Subscribe BEFORE joining the room so we don't
    // miss SEND_GREETING.
    const unsubscribe =
      subscribeToSendGreeting(
        (payload: SendGreetingPayload) => {
          console.log(
            '[Kiosk] Received SEND_GREETING',
            payload,
          );

          // --------------------------------------------------
          // Save session information
          // --------------------------------------------------

          if (payload.sessionId) {
            setSessionId(payload.sessionId);
            sessionIdRef.current =
              payload.sessionId;
          }

          if (payload.message) {
            setMessage(payload.message);
          }

          // --------------------------------------------------
          // Clean previous audio/recording
          // --------------------------------------------------

          cleanupAudio();
          cleanupRecording();

          // --------------------------------------------------
          // No audio fallback
          // --------------------------------------------------

          if (!payload.audio) {
            console.warn(
              '[Kiosk] No greeting audio received.',
            );

            setState('listening');

            startRecording();

            return;
          }

          // --------------------------------------------------
          // Convert backend audio to ArrayBuffer
          // --------------------------------------------------

          let arrayBuffer: ArrayBuffer | null =
            null;

          if (payload.audio instanceof ArrayBuffer) {
            arrayBuffer = payload.audio;
          } else if (
            ArrayBuffer.isView(payload.audio)
          ) {
            const view =
              payload.audio as Uint8Array;

            arrayBuffer = view.buffer.slice(
              view.byteOffset,
              view.byteOffset + view.byteLength,
            ) as ArrayBuffer;
          } else if (
            payload.audio?.type === 'Buffer' &&
            Array.isArray(payload.audio.data)
          ) {
            arrayBuffer =
              new Uint8Array(
                payload.audio.data,
              ).buffer;
          } else if (
            Array.isArray(payload.audio)
          ) {
            arrayBuffer =
              new Uint8Array(payload.audio).buffer;
          }

          // --------------------------------------------------
          // Audio couldn't be parsed
          // --------------------------------------------------

          if (!arrayBuffer) {
            console.warn(
              '[Kiosk] Could not parse greeting audio.',
            );

            setState('listening');

            startRecording();

            return;
          }

          console.log(
            '[Kiosk] Greeting audio bytes:',
            arrayBuffer.byteLength,
          );

          // --------------------------------------------------
          // Create playable audio
          // --------------------------------------------------

          const blob = new Blob(
            [arrayBuffer],
            {
              type: 'audio/mpeg',
            },
          );

          const objectUrl =
            URL.createObjectURL(blob);

          audioUrlRef.current = objectUrl;

          const audio =
            new Audio(objectUrl);

          currentAudioRef.current = audio;

          // --------------------------------------------------
          // TTS started
          // --------------------------------------------------

          audio.onplay = () => {
            console.log(
              '[Kiosk] Greeting audio started.',
            );

            setState('talking');
          };

          // --------------------------------------------------
          // TTS finished
          //
          // THIS IS WHERE RECORDING STARTS.
          // --------------------------------------------------

          audio.onended = () => {
            console.log(
              '[Kiosk] Greeting audio ended.',
            );

            cleanupAudio();

            // Customer can now answer.
            setState('listening');

            // Start microphone automatically.
            startRecording();
          };

          // --------------------------------------------------
          // TTS playback error
          // --------------------------------------------------

          audio.onerror = (event) => {
            console.error(
              '[Kiosk] Greeting audio playback error:',
              event,
            );

            cleanupAudio();

            // We still allow the customer to answer.
            setState('listening');

            startRecording();
          };

          // --------------------------------------------------
          // Audio metadata
          // --------------------------------------------------

          audio.onloadedmetadata = () => {
            console.log(
              '[Kiosk] Greeting duration:',
              audio.duration,
              'seconds',
            );
          };

          // --------------------------------------------------
          // Play greeting
          // --------------------------------------------------

          audio
            .play()
            .then(() => {
              console.log(
                '[Kiosk] Greeting audio play() succeeded.',
              );
            })
            .catch((error) => {
              console.error(
                '[Kiosk] Failed to play greeting automatically:',
                error,
              );

              cleanupAudio();

              setState('listening');

              startRecording();
            });
        },
      );

    // Join the gate AFTER subscribing.
    joinGateRoom(gateId);

    // --------------------------------------------------
    // Component cleanup
    // --------------------------------------------------

    return () => {
      unsubscribe();

      cleanupAudio();

      const recorder =
        mediaRecorderRef.current;

      if (
        recorder &&
        recorder.state !== 'inactive'
      ) {
        try {
          recorder.stop();
        } catch (error) {
          console.error(
            '[Kiosk] Error stopping recorder during cleanup:',
            error,
          );
        }
      }

      mediaRecorderRef.current = null;

      cleanupRecording();
    };
  }, [gateId]);

  // --------------------------------------------------
  // Temporary testing buttons
  // --------------------------------------------------

  const handleChoice = (
    choice: 'yes' | 'no',
  ) => {
    console.log(
      `[Kiosk] Test button selected: ${choice}`,
    );

    console.log(
      `[Kiosk] Current session: ${sessionId}`,
    );

    // These buttons are ONLY for UI testing.
    // They do NOT replace the voice flow.
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

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
      {/* Avatar */}
      <KioskAvatar
        state={state}
        size={340}
      />

      {/* Message */}
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
            boxShadow:
              '0 4px 12px rgba(0,0,0,0.3)',
            direction: 'rtl',
          }}
        >
          {message}
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 16,
            direction: 'rtl',
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#ef5350',
              display: 'inline-block',
            }}
          />

          جاري الاستماع...
        </div>
      )}

      {/* Temporary testing buttons */}
      {state === 'listening' && !isRecording && (
        <div
          style={{
            display: 'flex',
            gap: 16,
          }}
        >
          <button
            onClick={() =>
              handleChoice('yes')
            }
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
            onClick={() =>
              handleChoice('no')
            }
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
      {!audioUnlocked && (
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
)}
    </main>
  );
}

// --------------------------------------------------
// Page wrapper
// --------------------------------------------------

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