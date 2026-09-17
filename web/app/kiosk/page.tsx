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

// ------------------------------------------------------------
// Backend-driven input mode.
// ------------------------------------------------------------

type InputMode = 'VOICE' | 'BUTTONS' | 'TEXT';

type KioskOutputPayloadWithMode = KioskOutputPayload & {
  inputMode?: InputMode;
};

// ------------------------------------------------------------
// Voice Activity Detection configuration
// ------------------------------------------------------------

const SPEAKING_THRESHOLD = 0.2;
const SILENCE_THRESHOLD = 0.1;
const SILENCE_DURATION = 2500;

const MAX_RECORD_TIME = 100000;
const NO_SPEECH_TIMEOUT = 7000;

// How often to print RMS debug information.
// This avoids flooding the browser console every animation frame.
const RMS_LOG_INTERVAL = 100;

// ------------------------------------------------------------
// Component
// ------------------------------------------------------------

function KioskPageContent() {
  const searchParams = useSearchParams();

  const gateId = searchParams.get('gateId') || 'gate-1';

  // ------------------------------------------------------------
  // Frontend/UI state
  // ------------------------------------------------------------

  const [state, setState] = useState<AvatarState>('idle');

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const [nameInput, setNameInput] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);

  const [showConfirmationButtons, setShowConfirmationButtons] =
    useState(false);

  const [showPhoneInput, setShowPhoneInput] = useState(false);

  const [phoneInput, setPhoneInput] = useState('');

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

  const isRecordingRef = useRef(false);

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

  const sessionIdRef = useRef<string | null>(null);

  const sessionStateRef = useRef<string | null>(null);

  const inputModeRef = useRef<InputMode>('VOICE');

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
  // Hide every input UI
  // ------------------------------------------------------------

  const hideAllInputUI = () => {
    setShowNameInput(false);
    setShowConfirmationButtons(false);
    setShowPhoneInput(false);
  };

  // ------------------------------------------------------------
  // Start recording
  // ------------------------------------------------------------

  const startRecording = async () => {
  if (isRecordingRef.current) {
    console.warn('[Kiosk][VAD] Recording already active.');
    return;
  }

  const currentSessionId = sessionIdRef.current;

  if (!currentSessionId) {
    console.warn(
      '[Kiosk][VAD] Cannot start recording: sessionId is missing',
    );

    setIdle();
    return;
  }

  const currentState = sessionStateRef.current;

  if (!currentState) {
    console.warn(
      '[Kiosk][VAD] Cannot start recording: session state is missing',
    );

    setIdle();
    return;
  }

  console.log('========================================');
  console.log('[Kiosk][VAD] START RECORDING');
  console.log('========================================');

  console.log('[Kiosk][VAD] Configuration:', {
    SPEAKING_THRESHOLD,
    SILENCE_THRESHOLD,
    SILENCE_DURATION: `${SILENCE_DURATION} ms`,
    MAX_RECORD_TIME: `${MAX_RECORD_TIME} ms`,
    NO_SPEECH_TIMEOUT: `${NO_SPEECH_TIMEOUT} ms`,
  });

  console.log('[Kiosk][VAD] Session:', {
    sessionId: currentSessionId,
    state: currentState,
    gateId,
  });

  try {
    const stream =
      await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

    mediaStreamRef.current = stream;

    console.log('[Kiosk][VAD] Microphone access granted.');

    // ----------------------------------------------------------
    // Select supported recording format
    // ----------------------------------------------------------

    let mimeType = '';

    if (
      MediaRecorder.isTypeSupported(
        'audio/webm;codecs=opus',
      )
    ) {
      mimeType = 'audio/webm;codecs=opus';
    } else if (
      MediaRecorder.isTypeSupported('audio/webm')
    ) {
      mimeType = 'audio/webm';
    } else if (
      MediaRecorder.isTypeSupported(
        'audio/ogg;codecs=opus',
      )
    ) {
      mimeType = 'audio/ogg;codecs=opus';
    }

    console.log('[Kiosk][VAD] Selected MIME type:', mimeType || 'browser default');

    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    mediaRecorderRef.current = recorder;

    const chunks: BlobPart[] = [];

    let hasStartedSpeaking = false;
    let silenceStartedAt: number | null = null;

    // ----------------------------------------------------------
    // VAD logging
    //
    // We don't log every animation frame because that would
    // produce thousands of console messages.
    //
    // Instead, log approximately every 100ms.
    // ----------------------------------------------------------

    let lastVadLogTime = 0;

    const recordingStartedAt = Date.now();

    // ----------------------------------------------------------
    // Audio analysis
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

    // ----------------------------------------------------------
    // VAD loop
    // ----------------------------------------------------------

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

      const now = Date.now();

      const recordingDuration =
        now - recordingStartedAt;

      // --------------------------------------------------------
      // Threshold status
      // --------------------------------------------------------

      const reachedSpeakingThreshold =
        rms >= SPEAKING_THRESHOLD;

      const belowSilenceThreshold =
        rms < SILENCE_THRESHOLD;

      let silenceDuration = 0;

      if (silenceStartedAt !== null) {
        silenceDuration =
          now - silenceStartedAt;
      }

      // --------------------------------------------------------
      // Detailed VAD logging
      // --------------------------------------------------------

      if (now - lastVadLogTime >= 100) {
        lastVadLogTime = now;

        console.log('[Kiosk][VAD] Audio level:', {
          rms: Number(rms.toFixed(4)),

          speakingThreshold: SPEAKING_THRESHOLD,
          silenceThreshold: SILENCE_THRESHOLD,

          reachedSpeakingThreshold,
          belowSilenceThreshold,

          hasStartedSpeaking,

          silenceStarted:
            silenceStartedAt !== null,

          silenceDuration: `${silenceDuration} ms`,

          requiredSilenceDuration:
            `${SILENCE_DURATION} ms`,

          recordingDuration:
            `${recordingDuration} ms`,

          maxRecordTime:
            `${MAX_RECORD_TIME} ms`,
        });
      }

      // --------------------------------------------------------
      // SPEECH DETECTION
      // --------------------------------------------------------

      if (
        !hasStartedSpeaking &&
        reachedSpeakingThreshold
      ) {
        hasStartedSpeaking = true;

        silenceStartedAt = null;

        console.log('========================================');
        console.log('[Kiosk][VAD] 🗣️ SPEECH DETECTED');
        console.log('========================================');

        console.log('[Kiosk][VAD] Speech detection details:', {
          rms: Number(rms.toFixed(4)),
          speakingThreshold: SPEAKING_THRESHOLD,
          difference: Number(
            (rms - SPEAKING_THRESHOLD).toFixed(4),
          ),
          recordingDuration:
            `${recordingDuration} ms`,
        });
      }

      // --------------------------------------------------------
      // SILENCE DETECTION
      // --------------------------------------------------------

      if (hasStartedSpeaking) {
        if (belowSilenceThreshold) {
          // First frame below silence threshold
          if (silenceStartedAt === null) {
            silenceStartedAt = now;

            console.log(
              '[Kiosk][VAD] Silence started.',
            );

            console.log(
              '[Kiosk][VAD] Silence details:',
              {
                rms: Number(rms.toFixed(4)),
                silenceThreshold:
                  SILENCE_THRESHOLD,
                recordingDuration:
                  `${recordingDuration} ms`,
              },
            );
          } else {
            silenceDuration =
              now - silenceStartedAt;

            // --------------------------------------------------
            // Required silence reached
            // --------------------------------------------------

            if (
              silenceDuration >=
              SILENCE_DURATION
            ) {
              console.log(
                '========================================',
              );

              console.log(
                '[Kiosk][VAD] 🤫 SILENCE THRESHOLD REACHED',
              );

              console.log(
                '========================================',
              );

              console.log(
                '[Kiosk][VAD] Silence details:',
                {
                  rms: Number(rms.toFixed(4)),
                  silenceThreshold:
                    SILENCE_THRESHOLD,

                  silenceDuration:
                    `${silenceDuration} ms`,

                  requiredSilence:
                    `${SILENCE_DURATION} ms`,

                  recordingDuration:
                    `${recordingDuration} ms`,
                },
              );

              stopRecording();

              return;
            }
          }
        } else {
          // User is speaking again.
          if (silenceStartedAt !== null) {
            console.log(
              '[Kiosk][VAD] Speech resumed.',
            );

            console.log(
              '[Kiosk][VAD] Previous silence duration:',
              `${now - silenceStartedAt} ms`,
            );
          }

          silenceStartedAt = null;
        }
      }

      // --------------------------------------------------------
      // Continue VAD loop
      // --------------------------------------------------------

      animationFrameRef.current =
        requestAnimationFrame(
          checkAudioLevel,
        );
    };

    // ----------------------------------------------------------
    // Recorder events
    // ----------------------------------------------------------

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    // ----------------------------------------------------------
    // Recording stopped
    // ----------------------------------------------------------

    recorder.onstop = async () => {
      const recordingDuration =
        Date.now() - recordingStartedAt;

      console.log('========================================');
      console.log('[Kiosk][VAD] RECORDING STOPPED');
      console.log('========================================');

      console.log(
        '[Kiosk][VAD] Final recording information:',
        {
          recordingDuration,
          recordingDurationSeconds:
            Number(
              (
                recordingDuration / 1000
              ).toFixed(2),
            ),

          hasStartedSpeaking,

          chunks: chunks.length,

          maxRecordTime:
            `${MAX_RECORD_TIME} ms`,

          noSpeechTimeout:
            `${NO_SPEECH_TIMEOUT} ms`,

          silenceDuration:
            `${SILENCE_DURATION} ms`,

          speakingThreshold:
            SPEAKING_THRESHOLD,

          silenceThreshold:
            SILENCE_THRESHOLD,
        },
      );

      console.log('========================================');

      isRecordingRef.current = false;
      setIsRecording(false);

      // The kiosk is no longer listening.
      setIdle();

      cleanupRecording();

      mediaRecorderRef.current = null;

      if (chunks.length === 0) {
        console.warn(
          '[Kiosk][VAD] No audio chunks were recorded.',
        );

        setIdle();
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

          setIdle();
          return;
        }

        const currentState =
          sessionStateRef.current;

        if (!currentState) {
          console.warn(
            '[Kiosk] Cannot emit INPUT: session state is missing.',
          );

          setIdle();
          return;
        }

        console.log(
          '[Kiosk] Sending INPUT:',
          {
            sessionId: currentSessionId,
            gateId,
            state: currentState,
            audioBytes:
              arrayBuffer.byteLength,
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

        setIdle();
      }
    };

    // ----------------------------------------------------------
    // Recorder error
    // ----------------------------------------------------------

    recorder.onerror = (event) => {
      console.error(
        '[Kiosk][VAD] MediaRecorder error:',
        event,
      );

      isRecordingRef.current = false;
      setIsRecording(false);

      cleanupRecording();

      mediaRecorderRef.current = null;

      setIdle();
    };

    // ----------------------------------------------------------
    // Start recording
    // ----------------------------------------------------------

    recorder.start();

    isRecordingRef.current = true;
    setIsRecording(true);
    setState('listening');

    console.log(
      '[Kiosk][VAD] Recording started.',
    );

    console.log(
      '[Kiosk][VAD] Waiting for speech...',
    );

    console.log(
      '[Kiosk][VAD] Speaking threshold:',
      SPEAKING_THRESHOLD,
    );

    console.log(
      '[Kiosk][VAD] Silence threshold:',
      SILENCE_THRESHOLD,
    );

    // ----------------------------------------------------------
    // No speech timeout
    // ----------------------------------------------------------

    noSpeechTimeoutRef.current =
      setTimeout(() => {
        if (!hasStartedSpeaking) {
          console.log(
            '========================================',
          );

          console.log(
            '[Kiosk][VAD] NO SPEECH TIMEOUT REACHED',
          );

          console.log(
            '========================================',
          );

          console.log(
            '[Kiosk][VAD] No speech detected for:',
            `${NO_SPEECH_TIMEOUT} ms`,
          );

          console.log(
            '[Kiosk][VAD] Required speaking threshold:',
            SPEAKING_THRESHOLD,
          );

          console.log(
            '[Kiosk][VAD] Last state:',
            {
              hasStartedSpeaking,
              speakingThreshold:
                SPEAKING_THRESHOLD,
            },
          );

          console.log(
            '========================================',
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
          '========================================',
        );

        console.log(
          '[Kiosk][VAD] MAXIMUM RECORDING TIME REACHED',
        );

        console.log(
          '========================================',
        );

        console.log(
          '[Kiosk][VAD] Maximum allowed recording:',
          `${MAX_RECORD_TIME} ms`,
        );

        console.log(
          '[Kiosk][VAD] Has speech started:',
          hasStartedSpeaking,
        );

        console.log(
          '========================================',
        );

        stopRecording();
      }, MAX_RECORD_TIME);

    // ----------------------------------------------------------
    // Start VAD
    // ----------------------------------------------------------

    checkAudioLevel();
  } catch (error) {
    console.error(
      '[Kiosk][VAD] Failed to start recording:',
      error,
    );

    cleanupRecording();

    mediaRecorderRef.current = null;

    isRecordingRef.current = false;

    setIsRecording(false);

    setIdle();
  }
};

  // ------------------------------------------------------------
  // Unlock browser audio
  // ------------------------------------------------------------

  const unlockAudio = async () => {
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
  // Submit name
  // ------------------------------------------------------------

  const submitName = () => {
    const name =
      nameInput.trim();

    if (!name) {
      return;
    }

    const currentSessionId =
      sessionIdRef.current;

    if (!currentSessionId) {
      console.warn(
        '[Kiosk] Cannot submit name: sessionId is missing',
      );

      return;
    }

    console.log(
      '[Kiosk] Sending INPUT:',
      {
        sessionId:
          currentSessionId,
        gateId,
        state:
          'NAME_ASKING',
        audioBytes: 0,
        text: name,
      },
    );

    emitInput({
      sessionId:
        currentSessionId,
      gateId,
      state:
        'NAME_ASKING',
      text: name,
    });

    setShowNameInput(false);

    setNameInput('');

    setIdle();
  };

  // ------------------------------------------------------------
  // Submit phone
  // ------------------------------------------------------------

  const submitPhone = () => {
    const phone =
      phoneInput.trim();

    if (!phone) {
      return;
    }

    const currentSessionId =
      sessionIdRef.current;

    if (!currentSessionId) {
      console.warn(
        '[Kiosk] Cannot submit phone number: sessionId is missing',
      );

      return;
    }

    console.log(
      '[Kiosk] Sending INPUT:',
      {
        sessionId:
          currentSessionId,
        gateId,
        state:
          'PHONE_ASKING',
        audioBytes: 0,
        text: phone,
      },
    );

    emitInput({
      sessionId:
        currentSessionId,
      gateId,
      state:
        'PHONE_ASKING',
      text: phone,
    });

    setShowPhoneInput(false);

    setPhoneInput('');

    setIdle();
  };

  // ------------------------------------------------------------
  // Confirmation buttons
  // ------------------------------------------------------------

  const sendConfirmation = (
    answer: 'نعم' | 'لا',
  ) => {
    const currentSessionId =
      sessionIdRef.current;

    if (!currentSessionId) {
      console.warn(
        '[Kiosk] Cannot send confirmation: sessionId is missing',
      );

      return;
    }

    console.log(
      '[Kiosk] Sending INPUT:',
      {
        sessionId:
          currentSessionId,
        gateId,
        state:
          'CONFIRMING_PHONE',
        audioBytes: 0,
        text: answer,
      },
    );

    emitInput({
      sessionId:
        currentSessionId,
      gateId,
      state:
        'CONFIRMING_PHONE',
      text: answer,
    });

    setShowConfirmationButtons(false);

    setIdle();
  };

  // ------------------------------------------------------------
  // Set idle
  // ------------------------------------------------------------

  const setIdle = () => {
    setState('idle');
    setMessage('');
  };

  // ------------------------------------------------------------
  // Backend OUTPUT listener
  // ------------------------------------------------------------

  useEffect(() => {
    console.log(
      `[Kiosk] Setting up OUTPUT listener for ${gateId}`,
    );

    const unsubscribe =
      subscribeToOutput(
        async (
          payload: KioskOutputPayload,
        ) => {
          console.log(
            '[Kiosk] OUTPUT received:',
            payload,
          );

          const typedPayload =
            payload as KioskOutputPayloadWithMode;

          // ------------------------------------------------------
          // Session
          // ------------------------------------------------------

          if (
            typedPayload.sessionId
          ) {
            sessionIdRef.current =
              typedPayload.sessionId;

            setSessionId(
              typedPayload.sessionId,
            );
          }

          // ------------------------------------------------------
          // Backend business state
          // ------------------------------------------------------

          if (typedPayload.state) {
            sessionStateRef.current =
              typedPayload.state;

            console.log(
              '[Kiosk] Backend business state:',
              typedPayload.state,
            );
          }

          // ------------------------------------------------------
          // Resolve input mode
          // ------------------------------------------------------

          const resolvedInputMode:
            InputMode =
            typedPayload.inputMode ??
            (
              typedPayload.state ===
              'NAME_ASKING'
                ? 'TEXT'
                : 'VOICE'
            );

          inputModeRef.current =
            resolvedInputMode;

          textInputStateRef.current =
            resolvedInputMode !==
            'VOICE';

          // ------------------------------------------------------
          // Input UI
          // ------------------------------------------------------

          hideAllInputUI();

          if (
            resolvedInputMode ===
            'BUTTONS'
          ) {
            setShowConfirmationButtons(
              true,
            );
          } else if (
            resolvedInputMode ===
            'TEXT'
          ) {
            if (
              typedPayload.state ===
              'NAME_ASKING'
            ) {
              setShowNameInput(
                true,
              );
            } else if (
              typedPayload.state ===
              'PHONE_ASKING'
            ) {
              setShowPhoneInput(
                true,
              );
            }
          }

          // ------------------------------------------------------
          // Clear stale inputs
          // ------------------------------------------------------

          if (
            !(
              resolvedInputMode ===
                'TEXT' &&
              typedPayload.state ===
                'NAME_ASKING'
            )
          ) {
            setNameInput('');
          }

          if (
            !(
              resolvedInputMode ===
                'TEXT' &&
              typedPayload.state ===
                'PHONE_ASKING'
            )
          ) {
            setPhoneInput('');
          }

          // ------------------------------------------------------
          // Message
          // ------------------------------------------------------

          setMessage(
            typedPayload.message ||
              '',
          );

          // ------------------------------------------------------
          // No audio
          // ------------------------------------------------------

          if (
            !typedPayload.audio
          ) {
            console.warn(
              '[Kiosk] OUTPUT has no audio.',
            );

            if (
              !textInputStateRef.current
            ) {
              setState(
                'listening',
              );

              startRecording();
            } else {
              setIdle();
            }

            return;
          }

          // ------------------------------------------------------
          // Audio processing
          // ------------------------------------------------------

          try {
            let audioBuffer:
              ArrayBuffer;

            // Case 1: ArrayBuffer
            if (
              typedPayload.audio instanceof
              ArrayBuffer
            ) {
              audioBuffer =
                typedPayload.audio;
            }

            // Case 2: Typed array
            else if (
              ArrayBuffer.isView(
                typedPayload.audio,
              )
            ) {
              const view =
                typedPayload.audio as Uint8Array;

              audioBuffer =
                view.buffer.slice(
                  view.byteOffset,
                  view.byteOffset +
                    view.byteLength,
                ) as ArrayBuffer;
            }

            // Case 3: Buffer-like
            else if (
              typedPayload.audio &&
              typeof typedPayload.audio ===
                'object' &&
              'data' in
                typedPayload.audio
            ) {
              const bufferData =
                (
                  typedPayload.audio as {
                    data: number[];
                  }
                ).data;

              audioBuffer =
                new Uint8Array(
                  bufferData,
                ).buffer;
            }

            // Case 4: Number array
            else if (
              Array.isArray(
                typedPayload.audio,
              )
            ) {
              audioBuffer =
                new Uint8Array(
                  typedPayload.audio,
                ).buffer;
            }

            // Unknown format
            else {
              console.error(
                '[Kiosk] Unsupported audio format:',
                typedPayload.audio,
              );

              if (
                !textInputStateRef.current
              ) {
                setState(
                  'listening',
                );

                startRecording();
              } else {
                setIdle();
              }

              return;
            }

            // ----------------------------------------------------
            // Cleanup previous audio
            // ----------------------------------------------------

            cleanupAudio();

            // ----------------------------------------------------
            // Create audio URL
            // ----------------------------------------------------

            const audioBlob =
              new Blob(
                [audioBuffer],
                {
                  type:
                    'audio/mpeg',
                },
              );

            const audioUrl =
              URL.createObjectURL(
                audioBlob,
              );

            audioUrlRef.current =
              audioUrl;

            const audio =
              new Audio(
                audioUrl,
              );

            currentAudioRef.current =
              audio;

            // ----------------------------------------------------
            // Audio starts
            // ----------------------------------------------------

            audio.onplay = () => {
              console.log(
                '[Kiosk] TTS started.',
              );

              setState(
                'talking',
              );
            };

            // ----------------------------------------------------
            // Audio finishes
            // ----------------------------------------------------

            audio.onended = () => {
              console.log(
                '[Kiosk] TTS finished.',
              );

              cleanupAudio();

              if (
                textInputStateRef.current
              ) {
                setIdle();

                return;
              }

              setState(
                'listening',
              );

              startRecording();
            };

            // ----------------------------------------------------
            // Audio error
            // ----------------------------------------------------

            audio.onerror = (
              event,
            ) => {
              console.error(
                '[Kiosk] Audio playback failed:',
                event,
              );

              cleanupAudio();

              if (
                textInputStateRef.current
              ) {
                setIdle();

                return;
              }

              setState(
                'listening',
              );

              startRecording();
            };

            // ----------------------------------------------------
            // Play TTS
            // ----------------------------------------------------

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

            if (
              textInputStateRef.current
            ) {
              setIdle();

              return;
            }

            setState(
              'listening',
            );

            startRecording();
          }
        },
      );

    // ----------------------------------------------------------
    // Join gate room
    // ----------------------------------------------------------

    joinGateRoom(
      gateId,
      'kiosk',
    );

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
  // Kiosk hardening
  // ------------------------------------------------------------

  useEffect(() => {
    const { style } =
      document.body;

    const previousOverscroll =
      style.overscrollBehavior;

    const previousUserSelect =
      style.userSelect;

    const previousTouchAction =
      style.touchAction;

    style.overscrollBehavior =
      'none';

    style.userSelect =
      'none';

    style.touchAction =
      'manipulation';

    return () => {
      style.overscrollBehavior =
        previousOverscroll;

      style.userSelect =
        previousUserSelect;

      style.touchAction =
        previousTouchAction;
    };
  }, []);

  // ------------------------------------------------------------
  // Arabic keyboard
  // ------------------------------------------------------------

  const handleKeyboardPress = (
    key: string,
  ) => {
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
      setNameInput(
        (prev) =>
          prev + ' ',
      );

      return;
    }

    setNameInput(
      (prev) =>
        prev + key,
    );
  };

  // ------------------------------------------------------------
  // Phone keypad
  // ------------------------------------------------------------

  const handlePhoneKeyPress = (
    key: string,
  ) => {
    if (key === '⌫') {
      setPhoneInput((prev) =>
        prev.slice(0, -1),
      );

      return;
    }

    if (key === 'مسح') {
      setPhoneInput('');

      return;
    }

    setPhoneInput(
      (prev) =>
        prev + key,
    );
  };

  // ------------------------------------------------------------
  // Keyboards
  // ------------------------------------------------------------

  const keyboardRows: string[][] = [
    [
      'ض',
      'ص',
      'ث',
      'ق',
      'ف',
      'غ',
      'ع',
      'ه',
      'خ',
      'ح',
      'ج',
    ],
    [
      'د',
      'ش',
      'س',
      'ي',
      'ب',
      'ل',
      'ا',
      'ت',
      'ن',
      'م',
      'ك',
    ],
    [
      'ط',
      'ئ',
      'ء',
      'ؤ',
      'ر',
      'لا',
      'ى',
      'ة',
      'و',
      'ز',
      'ظ',
      'إ',
      'أ',
    ],
  ];

  const phoneKeyboardRows: string[][] = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['مسح', '0', '⌫'],
  ];

  const isKeyboardActive =
    showNameInput ||
    showPhoneInput;

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------

  return (
    <main className="kiosk">
      <div className="kiosk-statusbar">
        <span className="kiosk-brand">
          Toyota Smart Gate
        </span>

        <span className="kiosk-gate-pill">
          بوابة {gateId}
        </span>
      </div>

      <div className="kiosk-stage">

        {!isKeyboardActive && (
          <div
            className={`kiosk-avatar-frame kiosk-avatar-frame--${state}`}
          >
            <KioskAvatar
              state={state}
              size={340}
            />
          </div>
        )}

        {message && (
          <p
            className="kiosk-message"
            dir="rtl"
            style={{
              fontSize:
                isKeyboardActive
                  ? 'clamp(1.6rem, 3vw, 2.2rem)'
                  : undefined,
            }}
          >
            {message}
          </p>
        )}

        {/* --------------------------------------------------
            Confirmation buttons
        -------------------------------------------------- */}

        {showConfirmationButtons && (
          <div
            className="kiosk-confirm-wrap"
            dir="rtl"
          >
            <button
              type="button"
              onClick={() =>
                sendConfirmation('نعم')
              }
              className="kiosk-confirm-btn kiosk-confirm-btn--yes"
            >
              نعم
            </button>

            <button
              type="button"
              onClick={() =>
                sendConfirmation('لا')
              }
              className="kiosk-confirm-btn kiosk-confirm-btn--no"
            >
              لا
            </button>
          </div>
        )}

        {/* --------------------------------------------------
            Name input
        -------------------------------------------------- */}

        {showNameInput && (
          <div className="kiosk-namecard">

            <input
              type="text"
              value={nameInput}
              readOnly
              placeholder="أدخل اسمك"
              dir="rtl"
              className="kiosk-name-input"
            />

            <div
              className="kiosk-keyboard"
              dir="rtl"
            >
              {keyboardRows.map(
                (
                  row,
                  rowIndex,
                ) => (
                  <div
                    className="kiosk-keyboard-row"
                    key={rowIndex}
                  >
                    {row.map(
                      (key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() =>
                            handleKeyboardPress(
                              key,
                            )
                          }
                          className="kiosk-key"
                        >
                          {key}
                        </button>
                      ),
                    )}
                  </div>
                ),
              )}
            </div>

            <div
              className="kiosk-keyboard-controls"
              dir="rtl"
            >
              <button
                type="button"
                onClick={() =>
                  handleKeyboardPress(
                    'مسافة',
                  )
                }
                className="kiosk-key kiosk-key--wide"
              >
                مسافة
              </button>

              <button
                type="button"
                onClick={() =>
                  handleKeyboardPress(
                    '⌫',
                  )
                }
                className="kiosk-key kiosk-key--control"
                aria-label="حذف حرف"
              >
                ⌫
              </button>

              <button
                type="button"
                onClick={() =>
                  handleKeyboardPress(
                    'مسح',
                  )
                }
                className="kiosk-key kiosk-key--control"
              >
                مسح
              </button>
            </div>

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

        {/* --------------------------------------------------
            Phone input
        -------------------------------------------------- */}

        {showPhoneInput && (
          <div className="kiosk-namecard">

            <input
              type="tel"
              value={phoneInput}
              readOnly
              placeholder="أدخل رقم الهاتف"
              dir="rtl"
              className="kiosk-name-input"
            />

            <div
              className="kiosk-keyboard"
              dir="rtl"
            >
              {phoneKeyboardRows.map(
                (
                  row,
                  rowIndex,
                ) => (
                  <div
                    className="kiosk-keyboard-row"
                    key={rowIndex}
                  >
                    {row.map(
                      (key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() =>
                            handlePhoneKeyPress(
                              key,
                            )
                          }
                          className={
                            key === '⌫' ||
                            key === 'مسح'
                              ? 'kiosk-key kiosk-key--control'
                              : 'kiosk-key'
                          }
                          aria-label={
                            key === '⌫'
                              ? 'حذف رقم'
                              : undefined
                          }
                        >
                          {key}
                        </button>
                      ),
                    )}
                  </div>
                ),
              )}
            </div>

            <button
              type="button"
              onClick={submitPhone}
              disabled={!phoneInput.trim()}
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

      {!audioUnlocked &&
        !isKeyboardActive && (
          <div className="kiosk-overlay">
            <div className="kiosk-overlay-card">

              <span className="kiosk-overlay-eyebrow">
                بوابة {gateId}
              </span>

              <p className="kiosk-overlay-title">
                اضغط للبدء
              </p>

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
            radial-gradient(
              120% 90% at 50% -10%,
              #1a2a52 0%,
              transparent 55%
            ),
            linear-gradient(
              160deg,
              var(--navy-900) 0%,
              var(--navy-800) 55%,
              var(--navy-950) 100%
            );

          color: var(--ink);

          font-family:
            'Tajawal',
            'Inter',
            system-ui,
            -apple-system,
            sans-serif;

          box-sizing: border-box;

          padding:
            clamp(14px, 2vh, 28px)
            clamp(16px, 3vw, 40px);
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
          font-size:
            clamp(0.95rem, 1.4vw, 1.3rem);

          font-weight: 600;

          letter-spacing: 0.02em;

          color: var(--ink-muted);
        }

        .kiosk-gate-pill {
          font-size:
            clamp(1.5rem, 2.2vw, 2rem);

          font-weight: 700;

          color: var(--ink);

          background: var(--panel);

          border:
            1px solid
            var(--panel-border);

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

          gap:
            clamp(
              14px,
              2.4vh,
              28px
            );

          text-align: center;
        }

        .kiosk-avatar-frame {
          position: relative;

          display: flex;

          align-items: center;
          justify-content: center;

          padding:
            clamp(
              10px,
              1.6vh,
              18px
            );

          border-radius: 50%;

          background:
            radial-gradient(
              closest-side,
              rgba(
                235,
                10,
                30,
                0.12
              ),
              transparent 72%
            );

          transition:
            background 0.3s ease;
        }

        .kiosk-avatar-frame::before {
          content: '';

          position: absolute;

          inset: 6%;

          border-radius: 50%;

          border:
            1.5px solid
            var(--panel-border);

          transition:
            border-color 0.3s ease,
            box-shadow 0.3s ease;
        }

        .kiosk-avatar-frame--listening::before {
          border-color:
            rgba(
              235,
              10,
              30,
              0.55
            );

          box-shadow:
            0 0 0 6px
            rgba(
              235,
              10,
              30,
              0.08
            );
        }

        .kiosk-avatar-frame--talking::before {
          border-color:
            rgba(
              120,
              170,
              255,
              0.5
            );

          box-shadow:
            0 0 0 6px
            rgba(
              120,
              170,
              255,
              0.08
            );
        }

        .kiosk-message {
          max-width: 22ch;

          margin: 0;

          font-size:
            clamp(
              2.4rem,
              5vw,
              4rem
            );

          font-weight: 800;

          line-height: 1.25;

          color: var(--ink);

          text-wrap: balance;
        }

        .kiosk-confirm-wrap {
          display: flex;

          gap:
            clamp(
              12px,
              2vw,
              24px
            );

          width:
            min(
              94vw,
              640px
            );

          animation:
            kiosk-rise
            0.32s ease;
        }

        .kiosk-confirm-btn {
          flex: 1;

          min-height:
            clamp(
              70px,
              10vh,
              100px
            );

          font-family: inherit;

          font-size:
            clamp(
              1.8rem,
              3vw,
              2.4rem
            );

          font-weight: 800;

          border-radius: 18px;

          cursor: pointer;

          transition:
            transform 0.08s ease,
            box-shadow 0.15s ease,
            background 0.12s ease;
        }

        .kiosk-confirm-btn--yes {
          color: #ffffff;

          background:
            linear-gradient(
              135deg,
              var(--toyota-red) 0%,
              var(--toyota-red-dim) 100%
            );

          border: none;

          box-shadow:
            0 10px 24px
            rgba(
              235,
              10,
              30,
              0.35
            );
        }

        .kiosk-confirm-btn--yes:hover {
          box-shadow:
            0 12px 30px
            rgba(
              235,
              10,
              30,
              0.45
            );
        }

        .kiosk-confirm-btn--no {
          color: var(--ink);

          background:
            rgba(
              255,
              255,
              255,
              0.06
            );

          border:
            1.5px solid
            var(--panel-border);
        }

        .kiosk-confirm-btn--no:hover {
          background:
            rgba(
              255,
              255,
              255,
              0.1
            );
        }

        .kiosk-confirm-btn:active {
          transform: scale(0.97);
        }

        .kiosk-confirm-btn:focus-visible {
          outline:
            3px solid
            rgba(
              120,
              170,
              255,
              0.7
            );

          outline-offset: 3px;
        }

        .kiosk-namecard {
          width:
            min(
              94vw,
              780px
            );

          display: flex;

          flex-direction: column;

          align-items: stretch;

          gap:
            clamp(
              8px,
              1.4vh,
              14px
            );

          background: var(--panel);

          border:
            1px solid
            var(--panel-border);

          border-radius: 22px;

          padding:
            clamp(
              14px,
              2vh,
              22px
            );

          backdrop-filter: blur(10px);

          box-shadow:
            0 20px 60px
            rgba(
              0,
              0,
              0,
              0.35
            );

          animation:
            kiosk-rise
            0.32s ease;
        }

        .kiosk-name-input {
          width: 100%;

          padding:
            0.5em
            0.8em;

          font-family: inherit;

          font-size:
            clamp(
              2.5rem,
              4vw,
              3rem
            );

          font-weight: 700;

          text-align: right;

          color: var(--ink);

          background:
            rgba(
              255,
              255,
              255,
              0.06
            );

          border:
            1px solid
            var(--panel-border);

          border-radius: 14px;

          outline: none;

          min-height: 1.9em;
        }

        .kiosk-keyboard {
          display: flex;

          flex-direction: column;

          gap:
            clamp(
              5px,
              0.9vh,
              9px
            );

          animation:
            kiosk-rise
            0.36s ease;
        }

        .kiosk-keyboard-row {
          display: flex;

          gap:
            clamp(
              4px,
              0.7vw,
              8px
            );
        }

        .kiosk-keyboard-controls {
          display: flex;

          gap:
            clamp(
              4px,
              0.7vw,
              8px
            );
        }

        .kiosk-key {
          flex: 1;

          min-height:
            clamp(
              46px,
              6.5vh,
              60px
            );

          font-family: inherit;

          font-size:
            clamp(
              1.75rem,
              2.4vw,
              2.25rem
            );

          font-weight: 600;

          color: var(--ink);

          background:
            rgba(
              255,
              255,
              255,
              0.06
            );

          border:
            1px solid
            var(--panel-border);

          border-radius: 12px;

          cursor: pointer;

          transition:
            background 0.12s ease,
            transform 0.08s ease,
            border-color 0.12s ease;
        }

        .kiosk-key:hover {
          background:
            rgba(
              255,
              255,
              255,
              0.1
            );
        }

        .kiosk-key:active {
          background:
            rgba(
              235,
              10,
              30,
              0.28
            );

          border-color:
            rgba(
              235,
              10,
              30,
              0.6
            );

          transform: scale(0.96);
        }

        .kiosk-key:focus-visible {
          outline:
            3px solid
            rgba(
              120,
              170,
              255,
              0.65
            );

          outline-offset: 2px;
        }

        .kiosk-key--wide {
          flex: 3;

          font-size:
            clamp(
              1.2rem,
              1.8vw,
              1.6rem
            );
        }

        .kiosk-key--control {
          flex: 1.2;

          font-size:
            clamp(
              1.2rem,
              1.8vw,
              1.6rem
            );
        }

        .kiosk-send-button {
          margin-top: 2px;

          width: 100%;

          min-height:
            clamp(
              56px,
              7.5vh,
              70px
            );

          font-family: inherit;

          font-size:
            clamp(
              1.7rem,
              2.6vw,
              2.2rem
            );

          font-weight: 800;

          color: #ffffff;

          background:
            linear-gradient(
              135deg,
              var(--toyota-red) 0%,
              var(--toyota-red-dim) 100%
            );

          border: none;

          border-radius: 14px;

          cursor: pointer;

          box-shadow:
            0 10px 24px
            rgba(
              235,
              10,
              30,
              0.35
            );

          transition:
            transform 0.08s ease,
            box-shadow 0.15s ease,
            opacity 0.15s ease;
        }

        .kiosk-send-button:not(:disabled):hover {
          box-shadow:
            0 12px 30px
            rgba(
              235,
              10,
              30,
              0.45
            );
        }

        .kiosk-send-button:not(:disabled):active {
          transform: scale(0.98);
        }

        .kiosk-send-button:focus-visible {
          outline:
            3px solid
            rgba(
              120,
              170,
              255,
              0.7
            );

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

          background:
            rgba(
              6,
              11,
              20,
              0.72
            );

          backdrop-filter: blur(4px);

          animation:
            kiosk-fade
            0.25s ease;
        }

        .kiosk-overlay-card {
          display: flex;

          flex-direction: column;

          align-items: center;

          gap:
            clamp(
              10px,
              1.6vh,
              18px
            );

          padding:
            clamp(
              28px,
              4vh,
              48px
            )
            clamp(
              28px,
              5vw,
              56px
            );

          background: var(--panel);

          border:
            1px solid
            var(--panel-border);

          border-radius: 24px;

          box-shadow:
            0 24px 70px
            rgba(
              0,
              0,
              0,
              0.5
            );

          text-align: center;
        }

        .kiosk-overlay-eyebrow {
          font-size:
            clamp(
              1.4rem,
              2vw,
              1.8rem
            );

          font-weight: 700;

          color: var(--ink-muted);
        }

        .kiosk-overlay-title {
          margin: 0;

          font-size:
            clamp(
              1.8rem,
              2.6vw,
              2.4rem
            );

          font-weight: 700;

          color: var(--ink);
        }

        .kiosk-start-button {
          min-height:
            clamp(
              56px,
              7.5vh,
              70px
            );

          padding:
            0
            clamp(
              28px,
              4vw,
              48px
            );

          font-family: inherit;

          font-size:
            clamp(
              1.6rem,
              2vw,
              2rem
            );

          font-weight: 700;

          color: #ffffff;

          background:
            linear-gradient(
              135deg,
              var(--toyota-red) 0%,
              var(--toyota-red-dim) 100%
            );

          border: none;

          border-radius: 999px;

          cursor: pointer;

          box-shadow:
            0 10px 24px
            rgba(
              235,
              10,
              30,
              0.35
            );

          transition:
            transform 0.08s ease,
            box-shadow 0.15s ease;
        }

        .kiosk-start-button:hover {
          box-shadow:
            0 12px 30px
            rgba(
              235,
              10,
              30,
              0.45
            );
        }

        .kiosk-start-button:active {
          transform: scale(0.98);
        }

        .kiosk-start-button:focus-visible {
          outline:
            3px solid
            rgba(
              120,
              170,
              255,
              0.7
            );

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
          .kiosk-overlay,
          .kiosk-confirm-wrap {
            animation: none;
          }
        }

        @media (max-height: 560px) {
          .kiosk-message {
            font-size:
              clamp(
                1.8rem,
                4vw,
                2.6rem
              );
          }

          .kiosk-key {
            min-height:
              clamp(
                38px,
                6vh,
                50px
              );
          }
        }
      `}</style>
    </main>
  );
}

// ------------------------------------------------------------
// Page
// ------------------------------------------------------------

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
