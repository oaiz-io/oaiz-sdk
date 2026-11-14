import { useEffect, useId, useRef } from 'react';
import { cn } from '../../lib/utils';
import {
  SPEECH_AIR_BAND_HZ,
  SPEECH_AIR_GAIN,
  bandEnergy,
  followEnvelope,
  initialSpeechGate,
  normalizeSpeechRms,
  rmsFromTimeDomain,
  stepSpeechGate,
} from '../../lib/speech-level';

const STAGE_SIZE_PX = { desktop: 200, mobile: 180 } as const;
const COMPOSER_SIZE_PX = { desktop: 32, mobile: 28 } as const;

/** Blur of the resting mesh. Loud consonants pull it toward the speaking value. */
const REST_BLUR = 15;
const SPEAKING_BLUR = 9;

/**
 * How much each spot swells at full loudness. Three different gains make the
 * mesh wobble on a syllable instead of the whole orb zooming.
 */
const SPOT_SWELL = [0.18, 0.32, 0.45] as const;

export type VoiceOrbState = 'idle' | 'connecting' | 'live' | 'closing';

interface VoiceOrbProps {
  size: 'stage' | 'composer';
  state: VoiceOrbState;
  isMobile?: boolean;
  /** Analyser on the assistant playback track. Its loudness drives the speaking look. */
  outputAnalyser?: AnalyserNode | null;
}

/**
 * Drift mesh: three soft spots traveling farther than Rest, clipped to a
 * circle. Connecting and closing keep the same spots and only slow the drift.
 *
 * While the assistant is audible, a gated loudness envelope swells each spot
 * through the `--voice-body` custom property, high-band energy sharpens the
 * blur, and `data-speaking` switches on the sway animation from the stylesheet.
 */
export function VoiceOrb({
  size,
  state,
  isMobile = false,
  outputAnalyser = null,
}: VoiceOrbProps) {
  const reactId = useId().replace(/:/g, '');
  const blurId = `voice-orb-blur-${reactId}`;
  const clipId = `voice-orb-clip-${reactId}`;
  const gradientId = (name: string) => `voice-orb-${name}-${reactId}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const blurRef = useRef<SVGFEGaussianBlurElement>(null);
  const pixels =
    size === 'stage'
      ? isMobile
        ? STAGE_SIZE_PX.mobile
        : STAGE_SIZE_PX.desktop
      : isMobile
        ? COMPOSER_SIZE_PX.mobile
        : COMPOSER_SIZE_PX.desktop;
  const durationScale = state === 'live' ? 1 : 2.4;

  useEffect(() => {
    const svg = svgRef.current;
    const blur = blurRef.current;
    if (!svg || !blur || !outputAnalyser) return;

    const reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const samples = new Float32Array(outputAnalyser.fftSize);
    const bins = new Uint8Array(outputAnalyser.frequencyBinCount);
    const binHz = outputAnalyser.context.sampleRate / outputAnalyser.fftSize;
    let envelope = 0;
    let gate = initialSpeechGate();
    let frame = 0;
    // Last values written, so a silent orb costs no DOM writes per frame.
    let writtenBody = '';
    let writtenBlur = '';
    let writtenSpeaking = '';

    const tick = () => {
      outputAnalyser.getFloatTimeDomainData(samples);
      envelope = followEnvelope(
        envelope,
        normalizeSpeechRms(rmsFromTimeDomain(samples)),
      );
      gate = stepSpeechGate(gate, envelope);

      const animate = gate.open && !reducedMotion;
      let air = 0;
      if (animate) {
        outputAnalyser.getByteFrequencyData(bins);
        air = Math.min(
          1,
          bandEnergy(bins, binHz, ...SPEECH_AIR_BAND_HZ) * SPEECH_AIR_GAIN,
        );
      }
      const body = (animate ? envelope : 0).toFixed(3);
      const blurValue = (REST_BLUR - (REST_BLUR - SPEAKING_BLUR) * air).toFixed(
        1,
      );
      const speaking = gate.open ? 'true' : 'false';

      if (body !== writtenBody) {
        svg.style.setProperty('--voice-body', body);
        writtenBody = body;
      }
      if (blurValue !== writtenBlur) {
        blur.setAttribute('stdDeviation', blurValue);
        writtenBlur = blurValue;
      }
      if (speaking !== writtenSpeaking) {
        svg.setAttribute('data-speaking', speaking);
        writtenSpeaking = speaking;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      svg.style.removeProperty('--voice-body');
      blur.setAttribute('stdDeviation', String(REST_BLUR));
      svg.setAttribute('data-speaking', 'false');
    };
  }, [outputAnalyser]);

  return (
    <svg
      ref={svgRef}
      width={pixels}
      height={pixels}
      viewBox="0 0 200 200"
      aria-hidden
      data-testid="chat-live-voice-orb"
      data-size={size}
      data-state={state}
      data-speaking="false"
      className={cn('shrink-0', size === 'composer' && 'self-start')}
    >
      <defs>
        <linearGradient id={gradientId('blue-lime')}>
          <stop stopColor="var(--role-orb-blue)" />
          <stop offset="1" stopColor="var(--role-orb-lime)" />
        </linearGradient>
        <radialGradient id={gradientId('green-gold')}>
          <stop stopColor="var(--role-orb-center-light)" />
          <stop offset="0.25" stopColor="var(--role-orb-center)" />
          <stop offset="0.5" stopColor="var(--role-orb-gold)" />
          <stop offset="0.75" stopColor="var(--role-orb-lime-bright)" />
          <stop offset="1" stopColor="var(--role-orb-green)" />
        </radialGradient>
        <radialGradient id={gradientId('warm')}>
          <stop stopColor="var(--role-orb-red)" />
          <stop offset="0.25" stopColor="var(--role-orb-orange)" />
          <stop offset="1" stopColor="var(--role-orb-amber)" />
        </radialGradient>
        <filter
          id={blurId}
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur ref={blurRef} stdDeviation={REST_BLUR} />
        </filter>
        <clipPath id={clipId}>
          <circle cx="100" cy="100" r="100" />
        </clipPath>
      </defs>
      <g
        className="voice-orb-mesh"
        clipPath={`url(#${clipId})`}
        filter={`url(#${blurId})`}
      >
        <circle
          className="voice-orb-spot"
          style={{ transform: spotSwell(SPOT_SWELL[0]) }}
          fill={`url(#${gradientId('green-gold')})`}
          r="78"
          cx="58"
          cy="72"
        >
          <animate
            attributeName="cx"
            values="58;142;46;58"
            dur={`${8 * durationScale}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="cy"
            values="72;48;138;72"
            dur={`${10 * durationScale}s`}
            repeatCount="indefinite"
          />
        </circle>
        <circle
          className="voice-orb-spot"
          style={{ transform: spotSwell(SPOT_SWELL[1]) }}
          fill={`url(#${gradientId('blue-lime')})`}
          r="70"
          cx="128"
          cy="64"
        >
          <animate
            attributeName="cx"
            values="128;52;150;128"
            dur={`${9 * durationScale}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="cy"
            values="64;146;40;64"
            dur={`${11 * durationScale}s`}
            repeatCount="indefinite"
          />
        </circle>
        <circle
          className="voice-orb-spot"
          style={{ transform: spotSwell(SPOT_SWELL[2]) }}
          fill={`url(#${gradientId('warm')})`}
          r="74"
          cx="96"
          cy="132"
        >
          <animate
            attributeName="cx"
            values="96;40;154;96"
            dur={`${7 * durationScale}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="cy"
            values="132;58;150;132"
            dur={`${12 * durationScale}s`}
            repeatCount="indefinite"
          />
        </circle>
      </g>
    </svg>
  );
}

/** Each spot scales from its own centre by the shared loudness property. */
function spotSwell(gain: number): string {
  return `scale(calc(1 + var(--voice-body, 0) * ${gain}))`;
}
