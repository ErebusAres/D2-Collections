import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("completion audio", () => {
  it("plays the Destiny completion cue at the reduced volume", async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    const pause = vi.fn();
    const audio = {
      currentTime: 12,
      pause,
      play,
      preload: "",
      volume: 1,
    };
    const Audio = vi.fn(() => audio);
    vi.stubGlobal("Audio", Audio);
    vi.spyOn(performance, "now").mockReturnValue(1_000);

    const { playCompletionChime } = await import("./completionAudio");
    playCompletionChime();

    expect(Audio).toHaveBeenCalledWith("/audio/destiny-completion.mp3");
    expect(audio.preload).toBe("auto");
    expect(audio.volume).toBe(0.48);
    expect(audio.currentTime).toBe(0);
    expect(pause).toHaveBeenCalledOnce();
    expect(play).toHaveBeenCalledOnce();
  });
});
