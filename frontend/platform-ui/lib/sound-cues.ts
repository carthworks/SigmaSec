/**
 * Sound Cues Engine for SigmaSec Platform.
 * 
 * Uses the Web Audio API to synthesize smooth, micro-chimes on the fly
 * without downloading external audio files or causing network latency.
 * 
 * Includes:
 * - Ambient scan completion chime (uplifting 3-tone chord)
 * - AI recommendation sparkle (cyber intelligence chime)
 * - Action success ping (quick confirmation for PR / Jira)
 * - User mute preference persisted in localStorage
 * - Automatic debounce / anti-spam guardrails
 */

let audioCtx: AudioContext | null = null;
let lastPlayedAt = 0;
const DEBOUNCE_MS = 600;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (err) {
    return null;
  }
}

export function isSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("sigmasec_sound_muted") === "true";
}

export function toggleSound(): boolean {
  if (typeof window === "undefined") return false;
  const next = !isSoundMuted();
  localStorage.setItem("sigmasec_sound_muted", next ? "true" : "false");
  window.dispatchEvent(new CustomEvent("sigmasec-sound-toggle", { detail: { muted: next } }));
  if (!next) {
    // Play a friendly sample ping when unmuting
    playActionSuccessSound(true);
  }
  return !next;
}

/**
 * 1. SCAN COMPLETION CHIME:
 * Uplifting, gentle 3-tone chime (C5 -> E5 -> G5) indicating a scan has finished compiling.
 */
export function playScanCompleteSound(force = false) {
  if (!force && isSoundMuted()) return;
  const now = Date.now();
  if (now - lastPlayedAt < DEBOUNCE_MS) return;
  lastPlayedAt = now;

  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  const startTime = ctx.currentTime;

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, startTime + idx * 0.08);

    // Smooth ADSR envelope for a soft, pleasant chime
    const noteStart = startTime + idx * 0.08;
    gain.gain.setValueAtTime(0.001, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.14, noteStart + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteStart);
    osc.stop(noteStart + 0.3);
  });
}

/**
 * 2. AI RECOMMENDATION / ENRICHMENT CHIME:
 * Futuristic cyber-shimmer chime indicating an AI analysis or remediation has arrived.
 */
export function playAiRecommendationSound(force = false) {
  if (!force && isSoundMuted()) return;
  const now = Date.now();
  if (now - lastPlayedAt < DEBOUNCE_MS) return;
  lastPlayedAt = now;

  const ctx = getAudioContext();
  if (!ctx) return;

  const startTime = ctx.currentTime;
  // Two soft harmonic frequencies with shimmering decay (D5 587.33Hz + A5 880Hz)
  const freqs = [587.33, 880.0];

  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, startTime);
    // Slight upward frequency sweep for intelligence sparkle feel
    osc.frequency.exponentialRampToValueAtTime(freq * 1.04, startTime + 0.3);

    const noteStart = startTime + idx * 0.04;
    gain.gain.setValueAtTime(0.001, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.12, noteStart + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteStart);
    osc.stop(noteStart + 0.38);
  });
}

/**
 * 3. ACTION CONFIRMATION PING:
 * Minimal, crisp 1-tone ping for actions like 1-Click Fix PR created or Jira ticket created.
 */
export function playActionSuccessSound(force = false) {
  if (!force && isSoundMuted()) return;
  const now = Date.now();
  if (now - lastPlayedAt < DEBOUNCE_MS) return;
  lastPlayedAt = now;

  const ctx = getAudioContext();
  if (!ctx) return;

  const startTime = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(880, startTime); // A5
  osc.frequency.exponentialRampToValueAtTime(1046.5, startTime + 0.12); // C6

  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.12, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + 0.2);
}
