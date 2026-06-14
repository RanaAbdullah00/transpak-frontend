import { unlockNotificationSound } from './notificationSound.js';

let audioCtx;
let unlocked = false;
const lastPlayedAt = new Map();
const MIN_GAP_MS = 450;

function getCtx() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

function playTone(freq, durationSec, gainPeak = 0.07) {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
      if (!unlocked) return;
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = gainPeak;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t0 = ctx.currentTime;
    osc.start(t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + durationSec);
    osc.stop(t0 + durationSec + 0.02);
  } catch {
    /* autoplay blocked */
  }
}

const SOUND_PROFILES = Object.freeze({
  accept: { freq: 880, dur: 0.22, gain: 0.12 },
  reject: { freq: 220, dur: 0.28, gain: 0.11 },
  suggest: { freq: 520, dur: 0.14, gain: 0.09 },
  status: { freq: 640, dur: 0.12, gain: 0.08 },
  contract: { freq: 740, dur: 0.32, gain: 0.13 }
});

/**
 * Play notification sound by engine soundType (debounced per type).
 */
export function playNotificationSoundForType(soundType = 'status') {
  playNotificationSoundForBurst(soundType, soundType);
}

/** One sound per event burst (dispatch + ref + time bucket). */
export function playNotificationSoundForBurst(soundType = 'status', burstKey = '') {
  const key = String(soundType || 'status').toLowerCase();
  const burst = String(burstKey || key);
  const now = Date.now();
  if (now - (lastPlayedAt.get(burst) || 0) < MIN_GAP_MS) return;
  lastPlayedAt.set(burst, now);

  unlockNotificationSound();
  unlocked = true;

  const profile = SOUND_PROFILES[key] || SOUND_PROFILES.status;
  playTone(profile.freq, profile.dur, profile.gain);

  if (key === 'contract') {
    window.setTimeout(() => playTone(980, 0.18, 0.06), 180);
  }
}

if (typeof document !== 'undefined') {
  const unlockOnce = () => {
    unlockNotificationSound();
    unlocked = true;
    document.removeEventListener('pointerdown', unlockOnce, true);
    document.removeEventListener('keydown', unlockOnce, true);
  };
  document.addEventListener('pointerdown', unlockOnce, true);
  document.addEventListener('keydown', unlockOnce, true);
}
