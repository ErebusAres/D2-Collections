const COMPLETION_SOUND = "/audio/destiny-completion.mp3";
let completionAudio: HTMLAudioElement | undefined;
let lastPlayedAt = 0;

export function primeCompletionAudio(): void {
  const audio = getCompletionAudio();
  if (!audio) return;
  audio.volume = 0.01;
  void audio.play().then(() => {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 0.82;
  }).catch(() => undefined);
}

export function playCompletionChime(): void {
  const audio = getCompletionAudio();
  if (!audio) return;
  const playedAt = performance.now();
  if (playedAt - lastPlayedAt < 250) return;
  lastPlayedAt = playedAt;
  audio.pause();
  audio.currentTime = 0;
  audio.volume = 0.82;
  void audio.play().catch(() => undefined);
}

function getCompletionAudio(): HTMLAudioElement | undefined {
  if (completionAudio) return completionAudio;
  if (typeof Audio === "undefined") return undefined;
  completionAudio = new Audio(COMPLETION_SOUND);
  completionAudio.preload = "auto";
  return completionAudio;
}