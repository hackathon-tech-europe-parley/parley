export class TTSPlayer {
  private cache = new Map<string, string>(); // cacheKey → objectURL
  private audio: HTMLAudioElement | null = null;
  private endedHandler: (() => void) | null = null;
  private errorHandler: (() => void) | null = null;
  private playing = false;
  private playPromise: Promise<void> | null = null;

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
    this.playing = false;
  }

  async play(text: string, cacheKey: string, languageCode?: string): Promise<void> {
    // If there's already a play operation in progress, wait for it to complete
    if (this.playPromise) {
      await this.playPromise;
    }

    // Stop any currently playing audio first
    this.stop();
    
    // Wait for the audio to fully stop and reset
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create a promise for this play operation
    this.playPromise = this._doPlay(text, cacheKey, languageCode);
    
    try {
      await this.playPromise;
    } finally {
      this.playPromise = null;
    }
  }

  private async _doPlay(text: string, cacheKey: string, languageCode?: string): Promise<void> {

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

    // Reuse existing audio element or create a new one
    if (!this.audio) {
      this.audio = new Audio();
    }

    // Set up event handlers
    this.endedHandler = () => {
      this.playing = false;
    };
    
    this.errorHandler = () => {
      this.playing = false;
    };
    
    this.audio.addEventListener('ended', this.endedHandler, { once: true });
    this.audio.addEventListener('error', this.errorHandler, { once: true });
    
    // Set the source, load, and play
    this.audio.src = url;
    this.audio.load(); // Ensure the audio is properly loaded
    this.playing = true;
    await this.audio.play();
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
