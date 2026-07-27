let audioContext: AudioContext | undefined;
let lastPlayedAt = 0;

type AudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

export function primeCompletionAudio(): void {
  const context = getAudioContext();
  if (context?.state === "suspended") void context.resume().catch(() => undefined);
}

export function playCompletionChime(): void {
  const context = getAudioContext();
  if (!context) return;

  const play = () => {
    const playedAt = performance.now();
    if (playedAt - lastPlayedAt < 250) return;
    lastPlayedAt = playedAt;

    const start = context.currentTime;
    const master = context.createGain();
    const shimmer = context.createBiquadFilter();
    shimmer.type = "highpass";
    shimmer.frequency.setValueAtTime(420, start);
    master.gain.setValueAtTime(0.0001, start);
    master.gain.exponentialRampToValueAtTime(0.055, start + 0.018);
    master.gain.exponentialRampToValueAtTime(0.026, start + 0.16);
    master.gain.exponentialRampToValueAtTime(0.0001, start + 0.62);
    master.connect(shimmer);
    shimmer.connect(context.destination);

    completionTone(context, master, "sine", 523.25, 783.99, start, 0.52, 0);
    completionTone(context, master, "triangle", 783.99, 1046.5, start, 0.58, 0.045);
    completionTone(context, master, "sine", 1318.51, 1567.98, start, 0.42, 0.11);
  };

  if (context.state === "running") play();
  else void context.resume().then(play).catch(() => undefined);
}

function completionTone(
  context: AudioContext,
  destination: AudioNode,
  type: OscillatorType,
  startFrequency: number,
  endFrequency: number,
  start: number,
  duration: number,
  delay: number
): void {
  const tone = context.createOscillator();
  const gain = context.createGain();
  const toneStart = start + delay;
  tone.type = type;
  tone.frequency.setValueAtTime(startFrequency, toneStart);
  tone.frequency.exponentialRampToValueAtTime(endFrequency, toneStart + duration * 0.72);
  gain.gain.setValueAtTime(0.0001, toneStart);
  gain.gain.exponentialRampToValueAtTime(type === "triangle" ? 0.34 : 0.5, toneStart + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, toneStart + duration);
  tone.connect(gain);
  gain.connect(destination);
  tone.start(toneStart);
  tone.stop(toneStart + duration + 0.02);
}

function getAudioContext(): AudioContext | undefined {
  if (audioContext) return audioContext;
  if (typeof window === "undefined") return undefined;
  const Context = window.AudioContext || (window as AudioWindow).webkitAudioContext;
  if (!Context) return undefined;
  try {
    audioContext = new Context();
    return audioContext;
  } catch {
    return undefined;
  }
}
