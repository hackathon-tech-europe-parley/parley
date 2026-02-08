export class TTSPlayer {
  private cache = new Map<string, string>(); // cacheKey → objectURL
  private audio: HTMLAudioElement | null = null;
  private endedHandler: (() => void) | null = null;
  private errorHandler: (() => void) | null = null;
  private _playResolve: (() => void) | null = null;

  private playPromise: Promise<void> | null = null;
  private _muted = false;

  get muted(): boolean {
    return this._muted;
  }

  set muted(value: boolean) {
    this._muted = value;
    if (value) {
      this.stop();
    }
  }

  private cleanup(): void {
    if (this.audio) {
      // Remove event listeners
      if (this.endedHandler) {
        this.audio.removeEventListener('ended', this.endedHandler);
      }
      if (this.errorHandler) {
        this.audio.removeEventListener('error', this.errorHandler);
      }

      // Stop and reset audio
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio.src = '';
      this.audio.load(); // Reset the audio element
    }

    this.endedHandler = null;
    this.errorHandler = null;

    // Resolve any pending play promise so callers awaiting play() aren't stuck
    if (this._playResolve) {
      this._playResolve();
      this._playResolve = null;
    }
  }

  async play(text: string, cacheKey: string, languageCode?: string, npcGender?: string, speed?: number): Promise<void> {
    if (this._muted) return;

    // If there's already a play operation in progress, wait for it to complete
    if (this.playPromise) {
      await this.playPromise;
    }

    // Stop any currently playing audio first
    this.stop();

    // Wait for the audio to fully stop and reset
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create a promise for this play operation
    this.playPromise = this._doPlay(text, cacheKey, languageCode, npcGender, speed);

    try {
      await this.playPromise;
    } finally {
      this.playPromise = null;
    }
  }

  private async _doPlay(text: string, cacheKey: string, languageCode?: string, npcGender?: string, speed?: number): Promise<void> {
    // Include speed in cache key to cache different speeds separately
    const speedCacheKey = speed !== undefined ? `${cacheKey}-speed-${speed}` : cacheKey;

    let url = this.cache.get(speedCacheKey);
    if (!url) {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, languageCode, npcGender, speed }),
      });
      if (!res.ok) throw new Error("TTS fetch failed");
      const blob = await res.blob();
      url = URL.createObjectURL(blob);
      this.cache.set(speedCacheKey, url);
    }

    // Reuse existing audio element or create a new one
    if (!this.audio) {
      this.audio = new Audio();
    }

    // Set the source and load
    this.audio.src = url;
    this.audio.load();

    // Wait for playback to finish (ended event) or be interrupted (cleanup)
    return new Promise<void>((resolve) => {
      this._playResolve = resolve;

      this.endedHandler = () => {
        this._playResolve = null;
        resolve();
      };
      this.errorHandler = () => {
        this._playResolve = null;
        resolve();
      };

      this.audio!.addEventListener('ended', this.endedHandler, { once: true });
      this.audio!.addEventListener('error', this.errorHandler, { once: true });

      this.audio!.play().catch((err) => {
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          // Browser blocked autoplay — user hasn't interacted yet. Silently skip.
          this._playResolve = null;
          resolve();
          return;
        }
        this._playResolve = null;
        resolve(); // Resolve instead of reject to avoid unhandled errors
      });
    });
  }

  /** Fetch pre-generated audio from a URL and store in cache so play() is instant. */
  prefetchFromUrl(url: string, cacheKey: string): Promise<void> {
    if (this._muted) return Promise.resolve();
    if (this.cache.has(cacheKey)) return Promise.resolve();
    return fetch(url)
      .then((res) => {
        if (!res.ok) return;
        return res.blob();
      })
      .then((blob) => {
        if (blob && !this.cache.has(cacheKey)) {
          this.cache.set(cacheKey, URL.createObjectURL(blob));
        }
      })
      .catch(() => {
        // Best-effort; play() will retry on miss.
      });
  }

  /** Fetch TTS audio and store in cache so play() is instant. */
  prefetch(text: string, cacheKey: string, languageCode?: string, npcGender?: string, speed?: number): Promise<void> {
    if (this._muted) return Promise.resolve();
    // Include speed in cache key to cache different speeds separately
    const speedCacheKey = speed !== undefined ? `${cacheKey}-speed-${speed}` : cacheKey;
    if (this.cache.has(speedCacheKey)) return Promise.resolve();
    return fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, languageCode, npcGender, speed }),
    })
      .then((res) => {
        if (!res.ok) return;
        return res.blob();
      })
      .then((blob) => {
        if (blob && !this.cache.has(speedCacheKey)) {
          this.cache.set(speedCacheKey, URL.createObjectURL(blob));
        }
      })
      .catch(() => {
        // Best-effort; play() will retry on miss.
      });
  }

  stop(): void {
    this.cleanup();
    this.playPromise = null;
  }

  dispose(): void {
    this.cleanup();
    if (this.audio) {
      this.audio = null;
    }
    for (const url of this.cache.values()) {
      URL.revokeObjectURL(url);
    }
    this.cache.clear();
  }
}
