'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import {
  joinGateRoom,
  subscribeToOutput,
  emitInput,
  type KioskOutputPayload,
} from '../../lib/socket';
import { KioskAvatar } from '@/components/KioskAvatar';

type AvatarState = 'idle' | 'talking' | 'listening';

const SPEAKING_THRESHOLD = 0.2;
const SILENCE_THRESHOLD = 0.15;
const SILENCE_DURATION = 1800;
const MAX_RECORD_TIME = 15000;
const NO_SPEECH_TIMEOUT = 7000;

function KioskPageContent() {
  const searchParams = useSearchParams();

  const gateId = searchParams.get('gateId') || 'gate-1';

  // ------------------------------------------------------------
  // Frontend/UI state
  // ------------------------------------------------------------

  // This is ONLY the avatar state.
  // It is NOT the backend business/session state.
  const [state, setState] = useState<AvatarState>('idle');

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // ------------------------------------------------------------
  // Audio refs
  // ------------------------------------------------------------

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // ------------------------------------------------------------
  // Recording refs
  // ------------------------------------------------------------

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const maxRecordTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const noSpeechTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  // ------------------------------------------------------------
  // Session refs
  // ------------------------------------------------------------

  // React state is useful for rendering,
  // but refs are needed inside callbacks such as MediaRecorder.onstop.
  const sessionIdRef = useRef<string | null>(null);

  // Backend business state:
  // GREETING
  // CONFIRMING_PHONE
  // PHONE_ASKING
  // etc.
  //
  // This is NOT the same as AvatarState.
  const sessionStateRef = useRef<string | null>(null);

  // ------------------------------------------------------------
  // Cleanup recording
  // ------------------------------------------------------------

  const cleanupRecording = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (maxRecordTimeoutRef.current) {
      clearTimeout(maxRecordTimeoutRef.current);
      maxRecordTimeoutRef.current = null;
    }

    if (noSpeechTimeoutRef.current) {
      clearTimeout(noSpeechTimeoutRef.current);
      noSpeechTimeoutRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      mediaStreamRef.current = null;
    }
  };

  // ------------------------------------------------------------
  // Stop recording
  // ------------------------------------------------------------

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  // ------------------------------------------------------------
  // Cleanup audio
  // ------------------------------------------------------------

  const cleanupAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  };

  // ------------------------------------------------------------
  // Start recording
  // ------------------------------------------------------------

  const startRecording = async () => {
    if (isRecording) {
      return;
    }

    const currentSessionId = sessionIdRef.current;

    if (!currentSessionId) {
      console.warn(
        '[Kiosk] Cannot start recording: sessionId is missing',
      );

      setState('idle');
      return;
    }

    const currentState = sessionStateRef.current;

    if (!currentState) {
      console.warn(
        '[Kiosk] Cannot start recording: session state is missing',
      );

      setState('idle');
      return;
    }

    try {
      console.log(
        '[Kiosk] Starting recording...',
        {
          sessionId: currentSessionId,
          state: currentState,
        },
      );

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      mediaStreamRef.current = stream;

      // Prefer WebM/Opus.
      // Fall back to Ogg if necessary.
      let mimeType = '';

      if (
        MediaRecorder.isTypeSupported(
          'audio/webm;codecs=opus',
        )
      ) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (
        MediaRecorder.isTypeSupported(
          'audio/webm',
        )
      ) {
        mimeType = 'audio/webm';
      } else if (
        MediaRecorder.isTypeSupported(
          'audio/ogg;codecs=opus',
        )
      ) {
        mimeType = 'audio/ogg;codecs=opus';
      }

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      const chunks: BlobPart[] = [];

      let hasStartedSpeaking = false;
      let silenceStartedAt: number | null = null;

      // ----------------------------------------------------------
      // Audio analysis for voice activity detection
      // ----------------------------------------------------------

      const audioContext = new AudioContext();

      audioContextRef.current = audioContext;

      const source =
        audioContext.createMediaStreamSource(stream);

      const analyser =
        audioContext.createAnalyser();

      analyser.fftSize = 2048;

      source.connect(analyser);

      const dataArray = new Uint8Array(
        analyser.fftSize,
      );

      const checkAudioLevel = () => {
        if (
          !mediaRecorderRef.current ||
          mediaRecorderRef.current.state === 'inactive'
        ) {
          return;
        }

        analyser.getByteTimeDomainData(dataArray);

        let sum = 0;

        for (let i = 0; i < dataArray.length; i++) {
          const normalized =
            (dataArray[i] - 128) / 128;

          sum += normalized * normalized;
        }

        const rms = Math.sqrt(
          sum / dataArray.length,
        );

        // User started speaking.
        if (
          !hasStartedSpeaking &&
          rms >= SPEAKING_THRESHOLD
        ) {
          hasStartedSpeaking = true;
          silenceStartedAt = null;

          console.log(
            '[Kiosk] Speech detected',
          );
        }

        // After speech has started,
        // detect silence.
        if (hasStartedSpeaking) {
          if (rms < SILENCE_THRESHOLD) {
            if (silenceStartedAt === null) {
              silenceStartedAt = Date.now();
            } else {
              const silenceDuration =
                Date.now() - silenceStartedAt;

              if (
                silenceDuration >=
                SILENCE_DURATION
              ) {
                console.log(
                  '[Kiosk] Silence detected. Stopping recording.',
                );

                stopRecording();
                return;
              }
            }
          } else {
            silenceStartedAt = null;
          }
        }

        animationFrameRef.current =
          requestAnimationFrame(checkAudioLevel);
      };

      // ----------------------------------------------------------
      // Recorder events
      // ----------------------------------------------------------

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        console.log(
            '[Kiosk] Recording stopped.',
             );

        setIsRecording(false);

        // The kiosk is no longer listening.
        // It is now waiting for the backend response.
        setState('idle');

        cleanupRecording();

        mediaRecorderRef.current = null;

        if (chunks.length === 0) {
          console.warn(
            '[Kiosk] No audio chunks were recorded.',
          );

          setState('idle');
          return;
        }

        try {
          const blob = new Blob(chunks, {
            type:
              mimeType ||
              'audio/webm',
          });

          const arrayBuffer =
            await blob.arrayBuffer();

          const currentSessionId =
            sessionIdRef.current;

          if (!currentSessionId) {
            console.warn(
              '[Kiosk] Cannot emit INPUT: sessionId is missing.',
            );

            setState('idle');
            return;
          }

          const currentState =
            sessionStateRef.current;

          if (!currentState) {
            console.warn(
              '[Kiosk] Cannot emit INPUT: session state is missing.',
            );

            setState('idle');
            return;
          }

          // ------------------------------------------------------
          // Frontend -> Backend
          //
          // The frontend does NOT decide what the user's answer
          // means.
          //
          // It simply sends:
          // - sessionId
          // - gateId
          // - current backend state
          // - recorded audio
          //
          // Backend will:
          // INPUT
          //   -> STT
          //   -> NLU
          //   -> business logic
          // ------------------------------------------------------

          console.log(
            '[Kiosk] Sending INPUT:',
            {
              sessionId: currentSessionId,
              gateId,
              state: currentState,
              audioBytes: arrayBuffer.byteLength,
            },
          );

          emitInput({
            sessionId: currentSessionId,
            gateId,
            state: currentState,
            audio: arrayBuffer,
          });
        } catch (error) {
          console.error(
            '[Kiosk] Failed to process recorded audio:',
            error,
          );

          setState('idle');
        }
      };

      recorder.onerror = (event) => {
        console.error(
          '[Kiosk] MediaRecorder error:',
          event,
        );

        setIsRecording(false);

        cleanupRecording();

        mediaRecorderRef.current = null;

        setState('idle');
      };

      // ----------------------------------------------------------
      // Start recording
      // ----------------------------------------------------------

      recorder.start();

      setIsRecording(true);
      setState('listening');

      console.log(
        '[Kiosk] Recording started.',
      );

      // ----------------------------------------------------------
      // No speech timeout
      //
      // If the user does not speak at all for 7 seconds,
      // stop recording.
      // ----------------------------------------------------------

      noSpeechTimeoutRef.current =
        setTimeout(() => {
          if (!hasStartedSpeaking) {
            console.log(
              '[Kiosk] No speech detected. Stopping recording.',
            );

            stopRecording();
          }
        }, NO_SPEECH_TIMEOUT);

      // ----------------------------------------------------------
      // Maximum recording timeout
      // ----------------------------------------------------------

      maxRecordTimeoutRef.current =
        setTimeout(() => {
          console.log(
            '[Kiosk] Maximum recording time reached.',
          );

          stopRecording();
        }, MAX_RECORD_TIME);

      // Start VAD loop.
      checkAudioLevel();
    } catch (error) {
      console.error(
        '[Kiosk] Failed to start recording:',
        error,
      );

      cleanupRecording();

      mediaRecorderRef.current = null;

      setIsRecording(false);
      setState('idle');
    }
  };

  // ------------------------------------------------------------
  // Unlock browser audio
  // ------------------------------------------------------------

  const unlockAudio = async () => {
    try {
      const audio = new Audio();

      audio.muted = true;

      await audio.play().catch(() => {});

      audio.pause();

      setAudioUnlocked(true);

      console.log(
        '[Kiosk] Audio unlocked.',
      );
    } catch (error) {
      console.warn(
        '[Kiosk] Could not unlock audio:',
        error,
      );

      setAudioUnlocked(true);
    }
  };

  // ------------------------------------------------------------
  // Backend OUTPUT listener
  // ------------------------------------------------------------

  useEffect(() => {
    console.log(
      `[Kiosk] Setting up OUTPUT listener for ${gateId}`,
    );

    // IMPORTANT:
    // Subscribe BEFORE joining the room.
    //
    // This prevents a race where the backend sends OUTPUT
    // immediately after the kiosk joins.
    const unsubscribe = subscribeToOutput(
      async (payload: KioskOutputPayload) => {
        console.log(
          '[Kiosk] OUTPUT received:',
          payload,
        );

        // ------------------------------------------------------
        // Save backend session information
        // ------------------------------------------------------

        if (payload.sessionId) {
          sessionIdRef.current =
            payload.sessionId;

          setSessionId(
            payload.sessionId,
          );
        }

        // ------------------------------------------------------
        // Save backend business state
        //
        // This is NOT the avatar state.
        // ------------------------------------------------------

        if (payload.state) {
          sessionStateRef.current =
            payload.state;

          console.log(
            '[Kiosk] Backend business state:',
            payload.state,
          );
        }

        // ------------------------------------------------------
        // Update displayed message
        // ------------------------------------------------------

        setMessage(
          payload.message || '',
        );

        // ------------------------------------------------------
        // Handle audio
        // ------------------------------------------------------

        if (!payload.audio) {
          console.warn(
            '[Kiosk] OUTPUT has no audio.',
          );

          setState('listening');

          startRecording();

          return;
        }

        try {
          let audioBuffer: ArrayBuffer;

          // ----------------------------------------------------
          // Case 1: ArrayBuffer
          // ----------------------------------------------------

          if (
            payload.audio instanceof
            ArrayBuffer
          ) {
            audioBuffer =
              payload.audio;
          }

          // ----------------------------------------------------
          // Case 2: Uint8Array / typed array
          // ----------------------------------------------------

          else if (
            ArrayBuffer.isView(
              payload.audio,
            )
          ) {
            const view =
              payload.audio as
                Uint8Array;

            audioBuffer =
              view.buffer.slice(
                view.byteOffset,
                view.byteOffset +
                  view.byteLength,
              ) as ArrayBuffer;
          }

          // ----------------------------------------------------
          // Case 3: Socket.IO / Node Buffer-like object
          //
          // Example:
          // {
          //   type: "Buffer",
          //   data: [73, 68, 51, ...]
          // }
          // ----------------------------------------------------

          else if (
            payload.audio &&
            typeof payload.audio ===
              'object' &&
            'data' in payload.audio
          ) {
            const bufferData =
              (
                payload.audio as {
                  data: number[];
                }
              ).data;

            audioBuffer =
              new Uint8Array(
                bufferData,
              ).buffer;
          }

          // ----------------------------------------------------
          // Case 4: Array of numbers
          // ----------------------------------------------------

          else if (
            Array.isArray(
              payload.audio,
            )
          ) {
            audioBuffer =
              new Uint8Array(
                payload.audio,
              ).buffer;
          }

          // ----------------------------------------------------
          // Unknown format
          // ----------------------------------------------------

          else {
            console.error(
              '[Kiosk] Unsupported audio format:',
              payload.audio,
            );

            setState('listening');

            startRecording();

            return;
          }

          // ------------------------------------------------------
          // Clean previous audio
          // ------------------------------------------------------

          cleanupAudio();

          // ------------------------------------------------------
          // Create browser audio URL
          // ------------------------------------------------------

          const audioBlob =
            new Blob(
              [audioBuffer],
              {
                type: 'audio/mpeg',
              },
            );

          const audioUrl =
            URL.createObjectURL(
              audioBlob,
            );

          audioUrlRef.current =
            audioUrl;

          const audio =
            new Audio(audioUrl);

          currentAudioRef.current =
            audio;

          // ------------------------------------------------------
          // Audio starts
          // ------------------------------------------------------

          audio.onplay = () => {
            console.log(
              '[Kiosk] TTS started.',
            );

            setState('talking');
          };

          // ------------------------------------------------------
          // Audio finishes
          // ------------------------------------------------------

          audio.onended = () => {
            console.log(
              '[Kiosk] TTS finished.',
            );

            cleanupAudio();

            // The backend has already told us
            // what the next business state is.
            //
            // The avatar now starts listening.
            setState('listening');

            startRecording();
          };

          // ------------------------------------------------------
          // Audio error
          // ------------------------------------------------------

          audio.onerror = (event) => {
            console.error(
              '[Kiosk] Audio playback failed:',
              event,
            );

            cleanupAudio();

            // Even if TTS playback fails,
            // continue with the kiosk interaction.
            setState('listening');

            startRecording();
          };

          // ------------------------------------------------------
          // Play TTS
          // ------------------------------------------------------

          await audio.play();

          console.log(
            '[Kiosk] Playing TTS audio.',
          );
        } catch (error) {
          console.error(
            '[Kiosk] Failed to play OUTPUT audio:',
            error,
          );

          cleanupAudio();

          setState('listening');

          startRecording();
        }
      },
    );

    // ----------------------------------------------------------
    // Join gate room AFTER subscription is ready
    // ----------------------------------------------------------

    joinGateRoom(gateId);

    return () => {
      console.log(
        `[Kiosk] Cleaning up OUTPUT listener for ${gateId}`,
      );

      unsubscribe();

      stopRecording();
      cleanupRecording();
      cleanupAudio();
    };
  }, [gateId]);

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
      }}
    >
      <KioskAvatar
        state={state}
        size={340}
      />

      <div
        style={{
          textAlign: 'center',
        }}
      >
        <p>
          Gate: {gateId}
        </p>


        {message && (
          <p>
            {message}
          </p>
        )}

      </div>

      {!audioUnlocked && (
        <button
          onClick={unlockAudio}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            cursor: 'pointer',
          }}
        >
          Start Kiosk
        </button>
      )}
    </main>
  );
}

export default function KioskPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <KioskPageContent />
    </Suspense>
  );
}