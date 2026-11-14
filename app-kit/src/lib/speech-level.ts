/**
 * Pure signal math for the voice orb. The orb's animation frame reads an
 * AnalyserNode and feeds the numbers through these; nothing here touches
 * the DOM so every step is unit-testable.
 */

/** Amplitude of one AnalyserNode time-domain window. */
export function rmsFromTimeDomain(samples: Float32Array | number[]): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const sample of samples) {
    sum += sample * sample;
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Speech RMS sits well below 1.0 even when loud, so the raw value goes
 * through a gain before it drives anything visible.
 */
export function normalizeSpeechRms(rms: number, gain = 6): number {
  return Math.min(1, Math.max(0, rms * gain));
}

/**
 * Envelope follower with a fast attack and a slow release. Syllables snap the
 * level up and it eases down between words instead of flickering.
 */
export function followEnvelope(
  previous: number,
  next: number,
  attack = 0.5,
  release = 0.12,
): number {
  const alpha = next > previous ? attack : release;
  return previous + (next - previous) * alpha;
}

export interface SpeechGate {
  open: boolean;
  /** Consecutive frames above the opening threshold while closed. */
  aboveFrames: number;
  /** Frames left before a quiet stretch closes the gate. */
  holdFrames: number;
}

export interface SpeechGateOptions {
  openAbove: number;
  closeBelow: number;
  openFrames: number;
  holdFrames: number;
}

export const SPEECH_GATE_DEFAULTS: SpeechGateOptions = {
  openAbove: 0.12,
  closeBelow: 0.06,
  openFrames: 3,
  holdFrames: 12,
};

export function initialSpeechGate(): SpeechGate {
  return { open: false, aboveFrames: 0, holdFrames: 0 };
}

/**
 * Noise gate with hysteresis and a hold. It needs a few loud frames to open,
 * closes only below a lower threshold, and waits out short pauses so the
 * speaking look does not chatter between words.
 */
export function stepSpeechGate(
  gate: SpeechGate,
  level: number,
  options: SpeechGateOptions = SPEECH_GATE_DEFAULTS,
): SpeechGate {
  if (!gate.open) {
    const aboveFrames = level > options.openAbove ? gate.aboveFrames + 1 : 0;
    if (aboveFrames >= options.openFrames) {
      return { open: true, aboveFrames: 0, holdFrames: options.holdFrames };
    }
    return { open: false, aboveFrames, holdFrames: 0 };
  }

  if (level > options.closeBelow) {
    return { open: true, aboveFrames: 0, holdFrames: options.holdFrames };
  }
  const holdFrames = gate.holdFrames - 1;
  if (holdFrames <= 0) {
    return { open: false, aboveFrames: 0, holdFrames: 0 };
  }
  return { open: true, aboveFrames: 0, holdFrames };
}

/**
 * Mean magnitude of the byte-frequency bins between two frequencies, on a
 * 0..1 scale. `binHz` is sampleRate / fftSize.
 */
export function bandEnergy(
  bins: Uint8Array,
  binHz: number,
  fromHz: number,
  toHz: number,
): number {
  if (bins.length === 0 || binHz <= 0) return 0;
  const first = Math.max(0, Math.floor(fromHz / binHz));
  const last = Math.min(bins.length - 1, Math.ceil(toHz / binHz));
  if (last < first) return 0;
  let sum = 0;
  for (const magnitude of bins.subarray(first, last + 1)) {
    sum += magnitude;
  }
  return sum / ((last - first + 1) * 255);
}

/** Fricatives and sibilants live here; they sharpen the mesh edges. */
export const SPEECH_AIR_BAND_HZ: readonly [number, number] = [2000, 6000];

/** Gain that lifts typical speech "air" energy into a usable 0..1 range. */
export const SPEECH_AIR_GAIN = 2.5;
