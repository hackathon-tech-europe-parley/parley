export class TTSPlayer {
  private cache = new Map<string, string>(); // cacheKey → objectURL
  private current: HTMLAudioElement | null = null;

  async play(text: string, cacheKey: string, languageCode?: string): Promise<void> {
    this.stop();

    let url = this.cache.get(cacheKey);
    if (!url) {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, languageCode }),
      });
      if (!res.ok) throw new Error("TTS fetch failed");
      const blob = await res.blob();
      url = URL.createObjectURL(blob);
      this.cache.set(cacheKey, url);
    }

    const audio = new Audio(url);
    this.current = audio;
    await audio.play();
  }

  stop(): void {
    if (this.current) {
      this.current.pause();
      this.current.currentTime = 0;
      this.current = null;
    }
  }

  dispose(): void {
    this.stop();
    for (const url of this.cache.values()) {
      URL.revokeObjectURL(url);
    }
    this.cache.clear();
  }
}
