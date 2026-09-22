'use client';

import { useEffect, useRef, useState } from 'react';

export type AvatarState = 'idle' | 'listening' | 'talking';

interface KioskAvatarProps {
  /** Which state the avatar should show. Drive this from your kiosk's
   *  actual VAD / mic and TTS-playback state, not from a manual toggle. */
  state: AvatarState;
  /**
   * Optional live amplitude (0–1) for real lip-sync while talking, e.g. from
   * a Web Audio AnalyserNode reading the TTS playback. If omitted, the mouth
   * falls back to a canned speech-like animation.
   */
  audioLevel?: number;
  size?: number;
}

/**
 * Stylized character-face avatar for the kiosk UI.
 *
 * Three states:
 *  - idle:      slow breathing, occasional blink, neutral expression
 *  - listening: eyebrows lift, teal rings pulse outward, small input bars
 *  - talking:   mouth animates open/closed, warm amber glow pulses
 *
 * Purely presentational — feed it `state` from wherever you track
 * "mic is capturing" / "TTS audio is playing" in the kiosk service.
 */
export function KioskAvatar({ state, audioLevel, size = 320 }: KioskAvatarProps) {
  const [blinking, setBlinking] = useState(false);
  const blinkTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Organic, non-metronomic blinking — only while idle/listening.
  useEffect(() => {
    if (state === 'talking') return;

    const scheduleBlink = () => {
      const delay = 2200 + Math.random() * 3200;
      blinkTimeout.current = setTimeout(() => {
        setBlinking(true);
        setTimeout(() => setBlinking(false), 140);
        scheduleBlink();
      }, delay);
    };

    scheduleBlink();
    return () => clearTimeout(blinkTimeout.current);
  }, [state]);

  const mouthStyle =
    state === 'talking' && typeof audioLevel === 'number'
      ? { height: `${8 + Math.min(Math.max(audioLevel, 0), 1) * 34}px`, animation: 'none' as const }
      : undefined;

  return (
    <div
      className="kiosk-avatar"
      data-state={state}
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        state === 'listening' ? 'Assistant listening' : state === 'talking' ? 'Assistant speaking' : 'Assistant idle'
      }
    >
      <span className="ring ring-1" />
      <span className="ring ring-2" />
      <span className="ring ring-3" />

      <div className="face">
        <div className="brows">
          <span className="brow brow-left" />
          <span className="brow brow-right" />
        </div>

        <div className="eyes">
          <span className={`eye eye-left ${blinking ? 'blink' : ''}`} />
          <span className={`eye eye-right ${blinking ? 'blink' : ''}`} />
        </div>

        <div className="mouth" style={mouthStyle} />
      </div>

      <div className="input-bars">
        <span />
        <span />
        <span />
        <span />
      </div>

      <style jsx>{`
        .kiosk-avatar {
          --face: #2b2140;
          --face-deep: #1c1530;
          --feature: #f5f0e8;
          --glow: #33304a;
          --stage: #14121f;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: radial-gradient(circle at 50% 42%, var(--stage) 0%, #0c0a14 100%);
          transition: box-shadow 500ms ease;
          box-shadow: 0 0 70px var(--glow);
        }

        .kiosk-avatar[data-state='listening'] {
          --glow: rgba(111, 214, 198, 0.35);
        }

        .kiosk-avatar[data-state='talking'] {
          --glow: rgba(242, 166, 90, 0.4);
        }

        .face {
          position: relative;
          width: 62%;
          height: 62%;
          border-radius: 42% 42% 46% 46% / 46% 46% 42% 42%;
          background: linear-gradient(160deg, var(--face) 0%, var(--face-deep) 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          animation: breathe 4.5s ease-in-out infinite;
        }

        .kiosk-avatar[data-state='talking'] .face {
          animation: none;
        }

        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.018); }
        }

        .brows {
          position: absolute;
          top: 30%;
          width: 52%;
          display: flex;
          justify-content: space-between;
        }

        .brow {
          width: 22%;
          height: 3px;
          border-radius: 3px;
          background: var(--feature);
          opacity: 0.55;
          transform: translateY(10px) rotate(0deg);
          transition: transform 350ms ease, opacity 350ms ease;
        }

        .brow-right {
          transform: translateY(10px) rotate(0deg) scaleX(-1);
        }

        .kiosk-avatar[data-state='listening'] .brow {
          transform: translateY(0px) rotate(-6deg);
          opacity: 0.9;
        }

        .kiosk-avatar[data-state='listening'] .brow-right {
          transform: translateY(0px) rotate(6deg) scaleX(-1);
        }

        .eyes {
          display: flex;
          gap: 16%;
          margin-top: 6%;
        }

        .eye {
          width: 14px;
          height: 20px;
          border-radius: 999px;
          background: var(--feature);
          transition: transform 120ms ease, height 220ms ease;
        }

        .kiosk-avatar[data-state='listening'] .eye {
          height: 23px;
        }

        .eye.blink {
          transform: scaleY(0.08);
        }

        .mouth {
          margin-top: 12%;
          width: 34%;
          height: 5px;
          border-radius: 999px;
          background: var(--feature);
          transition: width 300ms ease, border-radius 300ms ease;
        }

        .kiosk-avatar[data-state='idle'] .mouth {
          border-radius: 0 0 40px 40px / 0 0 20px 20px;
        }

        .kiosk-avatar[data-state='talking'] .mouth {
          width: 26%;
          border-radius: 40%;
          animation: talk 1.05s ease-in-out infinite;
        }

        @keyframes talk {
          0%   { height: 6px; }
          20%  { height: 26px; }
          38%  { height: 12px; }
          55%  { height: 32px; }
          72%  { height: 10px; }
          88%  { height: 20px; }
          100% { height: 6px; }
        }

        .ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid #6fd6c6;
          opacity: 0;
          transform: scale(0.82);
        }

        .kiosk-avatar[data-state='listening'] .ring {
          animation: pulse 2.4s ease-out infinite;
        }

        .ring-2 { animation-delay: 0.6s !important; }
        .ring-3 { animation-delay: 1.2s !important; }

        @keyframes pulse {
          0%   { opacity: 0.55; transform: scale(0.82); }
          70%  { opacity: 0; transform: scale(1.18); }
          100% { opacity: 0; transform: scale(1.18); }
        }

        .input-bars {
          position: absolute;
          bottom: 10%;
          display: flex;
          align-items: flex-end;
          gap: 5px;
          height: 18px;
          opacity: 0;
          transition: opacity 300ms ease;
        }

        .kiosk-avatar[data-state='listening'] .input-bars {
          opacity: 0.85;
        }

        .input-bars span {
          width: 3px;
          border-radius: 2px;
          background: #6fd6c6;
          animation: bar 1s ease-in-out infinite;
        }

        .input-bars span:nth-child(1) { animation-delay: 0s; }
        .input-bars span:nth-child(2) { animation-delay: 0.15s; }
        .input-bars span:nth-child(3) { animation-delay: 0.3s; }
        .input-bars span:nth-child(4) { animation-delay: 0.45s; }

        @keyframes bar {
          0%, 100% { height: 5px; }
          50% { height: 18px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .face, .mouth, .ring, .input-bars span {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
