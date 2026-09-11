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
  const [nameInput, setNameInput] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);

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

  const maxRecordTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const noSpeechTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

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

  // Text input state
  const textInputStateRef = useRef(false);

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
      console.log('[Kiosk] Starting recording...', {
        sessionId: currentSessionId,
        state: currentState,
      });

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
    // Hide the "Start Kiosk" overlay immediately on tap,
    // so the customer never sees a delay. The actual audio
    // unlock work below still runs the same as before.
    setAudioUnlocked(true);

    try {
      const audio = new Audio();

      audio.muted = true;

      await audio.play().catch(() => {});

      audio.pause();

      console.log(
        '[Kiosk] Audio unlocked.',
      );
    } catch (error) {
      console.warn(
        '[Kiosk] Could not unlock audio:',
        error,
      );
    }
  };

  // ------------------------------------------------------------
  // Submit customer name
  // ------------------------------------------------------------

  const submitName = () => {
    const name = nameInput.trim();

    if (!name) {
      return;
    }

    const currentSessionId = sessionIdRef.current;

    if (!currentSessionId) {
      console.warn(
        '[Kiosk] Cannot submit name: sessionId is missing',
      );
      return;
    }

    console.log(
      '[Kiosk] Sending customer name:',
      name,
    );

    emitInput({
      sessionId: currentSessionId,
      gateId,
      state: 'NAME_ASKING',
      text: name,
    });

    // Hide keyboard.
    // Avatar will automatically appear again.
    setShowNameInput(false);
    setNameInput('');

    setState('idle');
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

          if (
            payload.state === 'NAME_ASKING'
          ) {
            textInputStateRef.current = true;
            setShowNameInput(true);
          } else {
            textInputStateRef.current = false;
            setShowNameInput(false);
          }
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

          if (!textInputStateRef.current) {
            setState('listening');
            startRecording();
          }

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
              payload.audio as Uint8Array;

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

            if (!textInputStateRef.current) {
              setState('listening');
              startRecording();
            }

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

            // NAME_ASKING uses keyboard input,
            // so do NOT start the microphone.
            if (textInputStateRef.current) {
              setState('idle');
              return;
            }

            // Other kiosk states use voice input.
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

            if (textInputStateRef.current) {
              setState('idle');
              return;
            }

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

          if (textInputStateRef.current) {
            setState('idle');
            return;
          }

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
  // Kiosk hardening (UI-only)
  //
  // Prevents the page from feeling like a normal scrollable
  // website: no overscroll bounce, no pull-to-refresh, no
  // pinch-zoom, no text selection on kiosk chrome. Purely
  // cosmetic/UX — does not touch session or business logic.
  // ------------------------------------------------------------

  useEffect(() => {
    const { style } = document.body;

    const previousOverscroll = style.overscrollBehavior;
    const previousUserSelect = style.userSelect;
    const previousTouchAction = style.touchAction;

    style.overscrollBehavior = 'none';
    style.userSelect = 'none';
    style.touchAction = 'manipulation';

    return () => {
      style.overscrollBehavior = previousOverscroll;
      style.userSelect = previousUserSelect;
      style.touchAction = previousTouchAction;
    };
  }, []);

  // ------------------------------------------------------------
  // Custom Arabic keyboard
  // ------------------------------------------------------------

  const handleKeyboardPress = (key: string) => {
    if (key === '⌫') {
      setNameInput((prev) =>
        prev.slice(0, -1),
      );
      return;
    }

    if (key === 'مسح') {
      setNameInput('');
      return;
    }

    if (key === 'مسافة') {
      setNameInput((prev) =>
        prev + ' ',
      );
      return;
    }

    setNameInput((prev) =>
      prev + key,
    );
  };

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------

  const keyboardRows: string[][] = [
    ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج'],
    ['د', 'ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك'],
    ['ط', 'ئ', 'ء', 'ؤ', 'ر', 'لا', 'ى', 'ة', 'و', 'ز', 'ظ', 'إ', 'أ'],
  ];

  return (
    <main className="kiosk">
      {/* ------------------------------------------------------
          Status bar: gate identity only. sessionId is never
          shown to the customer.
      ------------------------------------------------------ */}

      <div className="kiosk-statusbar">
        <span className="kiosk-brand">Toyota Smart Gate</span>
        <span className="kiosk-gate-pill">بوابة {gateId}</span>
      </div>

      {/* ------------------------------------------------------
          Main stage
      ------------------------------------------------------ */}

      <div className="kiosk-stage">
        {/* --------------------------------------------------
            Avatar

            Hidden while the customer is entering their name.
            It appears again automatically after إرسال.
        -------------------------------------------------- */}

        {!showNameInput && (
          <div className={`kiosk-avatar-frame kiosk-avatar-frame--${state}`}>
            <KioskAvatar state={state} size={340} />
          </div>
        )}

        {/* --------------------------------------------------
            Message
        -------------------------------------------------- */}

        {message && (
          <p
            className="kiosk-message"
            dir="rtl"
            style={{
              fontSize: showNameInput
                ? 'clamp(1.6rem, 3vw, 2.2rem)'
                : undefined,
            }}
          >
            {message}
          </p>
        )}

        {/* --------------------------------------------------
            NAME INPUT + CUSTOM KEYBOARD
        -------------------------------------------------- */}

        {showNameInput && (
          <div className="kiosk-namecard">
            {/* Name input */}

            <input
              type="text"
              value={nameInput}
              readOnly
              placeholder="أدخل اسمك"
              dir="rtl"
              className="kiosk-name-input"
            />

            {/* Arabic keyboard */}

            <div className="kiosk-keyboard" dir="rtl">
              {keyboardRows.map((row, rowIndex) => (
                <div className="kiosk-keyboard-row" key={rowIndex}>
                  {row.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleKeyboardPress(key)}
                      className="kiosk-key"
                    >
                      {key}
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {/* Keyboard controls */}

            <div className="kiosk-keyboard-controls" dir="rtl">
              <button
                type="button"
                onClick={() => handleKeyboardPress('مسافة')}
                className="kiosk-key kiosk-key--wide"
              >
                مسافة
              </button>

              <button
                type="button"
                onClick={() => handleKeyboardPress('⌫')}
                className="kiosk-key kiosk-key--control"
                aria-label="حذف حرف"
              >
                ⌫
              </button>

              <button
                type="button"
                onClick={() => handleKeyboardPress('مسح')}
                className="kiosk-key kiosk-key--control"
              >
                مسح
              </button>
            </div>

            {/* Submit */}

            <button
              type="button"
              onClick={submitName}
              disabled={!nameInput.trim()}
              className="kiosk-send-button"
            >
              إرسال
            </button>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------
          Start Kiosk overlay
      ------------------------------------------------------ */}

      {!audioUnlocked && !showNameInput && (
        <div className="kiosk-overlay">
          <div className="kiosk-overlay-card">
            <span className="kiosk-overlay-eyebrow">بوابة {gateId}</span>
            <p className="kiosk-overlay-title">اضغط للبدء</p>
            <button
              onClick={unlockAudio}
              className="kiosk-start-button"
            >
              Start Kiosk
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&family=Inter:wght@500;600;700&display=swap');
      `}</style>

      <style jsx>{`
        .kiosk {
          --navy-950: #060b14;
          --navy-900: #0a1220;
          --navy-800: #0f1b33;
          --navy-700: #17264a;
          --panel: rgba(255, 255, 255, 0.045);
          --panel-border: rgba(255, 255, 255, 0.09);
          --ink: #f4f6fb;
          --ink-muted: #93a0bd;
          --toyota-red: #eb0a1e;
          --toyota-red-dim: #a80c1a;

          position: relative;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          justify-content: flex-start;
          width: 100vw;
          height: 100dvh;
          overflow: hidden;
          background:
            radial-gradient(120% 90% at 50% -10%, #1a2a52 0%, transparent 55%),
            linear-gradient(160deg, var(--navy-900) 0%, var(--navy-800) 55%, var(--navy-950) 100%);
          color: var(--ink);
          font-family: 'Tajawal', 'Inter', system-ui, -apple-system, sans-serif;
          box-sizing: border-box;
          padding: clamp(14px, 2vh, 28px) clamp(16px, 3vw, 40px);
        }

        .kiosk * {
          box-sizing: border-box;
        }

        .kiosk-statusbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex: 0 0 auto;
          gap: 12px;
        }

        .kiosk-brand {
          font-size: clamp(0.95rem, 1.4vw, 1.3rem);
          font-weight: 600;
          letter-spacing: 0.02em;
          color: var(--ink-muted);
        }

        .kiosk-gate-pill {
          font-size: clamp(1.5rem, 2.2vw, 2rem);
          font-weight: 700;
          color: var(--ink);
          background: var(--panel);
          border: 1px solid var(--panel-border);
          border-radius: 999px;
          padding: 0.4em 1.1em;
          backdrop-filter: blur(6px);
        }

        .kiosk-stage {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: clamp(14px, 2.4vh, 28px);
          text-align: center;
        }

        .kiosk-avatar-frame {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(10px, 1.6vh, 18px);
          border-radius: 50%;
          background: radial-gradient(closest-side, rgba(235, 10, 30, 0.12), transparent 72%);
          transition: background 0.3s ease;
        }

        .kiosk-avatar-frame::before {
          content: '';
          position: absolute;
          inset: 6%;
          border-radius: 50%;
          border: 1.5px solid var(--panel-border);
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }

        .kiosk-avatar-frame--listening::before {
          border-color: rgba(235, 10, 30, 0.55);
          box-shadow: 0 0 0 6px rgba(235, 10, 30, 0.08);
        }

        .kiosk-avatar-frame--talking::before {
          border-color: rgba(120, 170, 255, 0.5);
          box-shadow: 0 0 0 6px rgba(120, 170, 255, 0.08);
        }

        .kiosk-message {
          max-width: 22ch;
          margin: 0;
          font-size: clamp(2.4rem, 5vw, 4rem);
          font-weight: 800;
          line-height: 1.25;
          color: var(--ink);
          text-wrap: balance;
        }

        .kiosk-namecard {
          width: min(94vw, 780px);
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: clamp(8px, 1.4vh, 14px);
          background: var(--panel);
          border: 1px solid var(--panel-border);
          border-radius: 22px;
          padding: clamp(14px, 2vh, 22px);
          backdrop-filter: blur(10px);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
          animation: kiosk-rise 0.32s ease;
        }

        .kiosk-name-input {
          width: 100%;
          padding: 0.5em 0.8em;
          font-family: inherit;
          font-size: clamp(2.5rem, 4vw, 3rem);
          font-weight: 700;
          text-align: right;
          color: var(--ink);
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--panel-border);
          border-radius: 14px;
          outline: none;
          min-height: 1.9em;
        }

        .kiosk-keyboard {
          display: flex;
          flex-direction: column;
          gap: clamp(5px, 0.9vh, 9px);
          animation: kiosk-rise 0.36s ease;
        }

        .kiosk-keyboard-row {
          display: flex;
          gap: clamp(4px, 0.7vw, 8px);
        }

        .kiosk-keyboard-controls {
          display: flex;
          gap: clamp(4px, 0.7vw, 8px);
        }

        .kiosk-key {
          flex: 1;
          min-height: clamp(46px, 6.5vh, 60px);
          font-family: inherit;
          font-size: clamp(1.75rem, 2.4vw, 2.25rem);
          font-weight: 600;
          color: var(--ink);
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--panel-border);
          border-radius: 12px;
          cursor: pointer;
          transition: background 0.12s ease, transform 0.08s ease, border-color 0.12s ease;
        }

        .kiosk-key:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .kiosk-key:active {
          background: rgba(235, 10, 30, 0.28);
          border-color: rgba(235, 10, 30, 0.6);
          transform: scale(0.96);
        }

        .kiosk-key:focus-visible {
          outline: 3px solid rgba(120, 170, 255, 0.65);
          outline-offset: 2px;
        }

        .kiosk-key--wide {
          flex: 3;
          font-size: clamp(1.2rem, 1.8vw, 1.6rem);
        }

        .kiosk-key--control {
          flex: 1.2;
          font-size: clamp(1.2rem, 1.8vw, 1.6rem);
        }

        .kiosk-send-button {
          margin-top: 2px;
          width: 100%;
          min-height: clamp(56px, 7.5vh, 70px);
          font-family: inherit;
          font-size: clamp(1.7rem, 2.6vw, 2.2rem);
          font-weight: 800;
          color: #ffffff;
          background: linear-gradient(135deg, var(--toyota-red) 0%, var(--toyota-red-dim) 100%);
          border: none;
          border-radius: 14px;
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(235, 10, 30, 0.35);
          transition: transform 0.08s ease, box-shadow 0.15s ease, opacity 0.15s ease;
        }

        .kiosk-send-button:not(:disabled):hover {
          box-shadow: 0 12px 30px rgba(235, 10, 30, 0.45);
        }

        .kiosk-send-button:not(:disabled):active {
          transform: scale(0.98);
        }

        .kiosk-send-button:focus-visible {
          outline: 3px solid rgba(120, 170, 255, 0.7);
          outline-offset: 3px;
        }

        .kiosk-send-button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          box-shadow: none;
        }

        .kiosk-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(6, 11, 20, 0.72);
          backdrop-filter: blur(4px);
          animation: kiosk-fade 0.25s ease;
        }

        .kiosk-overlay-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(10px, 1.6vh, 18px);
          padding: clamp(28px, 4vh, 48px) clamp(28px, 5vw, 56px);
          background: var(--panel);
          border: 1px solid var(--panel-border);
          border-radius: 24px;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.5);
          text-align: center;
        }

        .kiosk-overlay-eyebrow {
          font-size: clamp(1.4rem, 2vw, 1.8rem);
          font-weight: 700;
          color: var(--ink-muted);
        }

        .kiosk-overlay-title {
          margin: 0;
          font-size: clamp(1.8rem, 2.6vw, 2.4rem);
          font-weight: 700;
          color: var(--ink);
        }

        .kiosk-start-button {
          min-height: clamp(56px, 7.5vh, 70px);
          padding: 0 clamp(28px, 4vw, 48px);
          font-family: inherit;
          font-size: clamp(1.6rem, 2vw, 2rem);
          font-weight: 700;
          color: #ffffff;
          background: linear-gradient(135deg, var(--toyota-red) 0%, var(--toyota-red-dim) 100%);
          border: none;
          border-radius: 999px;
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(235, 10, 30, 0.35);
          transition: transform 0.08s ease, box-shadow 0.15s ease;
        }

        .kiosk-start-button:hover {
          box-shadow: 0 12px 30px rgba(235, 10, 30, 0.45);
        }

        .kiosk-start-button:active {
          transform: scale(0.98);
        }

        .kiosk-start-button:focus-visible {
          outline: 3px solid rgba(120, 170, 255, 0.7);
          outline-offset: 3px;
        }

        @keyframes kiosk-rise {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes kiosk-fade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .kiosk-namecard,
          .kiosk-keyboard,
          .kiosk-overlay {
            animation: none;
          }
        }

        @media (max-height: 560px) {
          .kiosk-message {
            font-size: clamp(1.8rem, 4vw, 2.6rem);
          }

          .kiosk-key {
            min-height: clamp(38px, 6vh, 50px);
          }
        }
      `}</style>
    </main>
  );
}

export default function KioskPage() {
  return (
    <Suspense
      fallback={
        <div>Loading...</div>
      }
    >
      <KioskPageContent />
    </Suspense>
  );
}
