const TARGET_SAMPLE_RATE = 24000;
const BUFFER_SIZE = 4096;

export class AudioRecorder {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];

  async start(): Promise<void> {
    this.chunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Use the browser's native sample rate to avoid silent-capture bugs
    // when forcing a non-native rate on MediaStreamSource
    this.context = new AudioContext();
    this.source = this.context.createMediaStreamSource(this.stream);
    this.processor = this.context.createScriptProcessor(BUFFER_SIZE, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const data = e.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(data));
    };

    this.source.connect(this.processor);
    this.processor.connect(this.context.destination);
  }

  async stop(): Promise<string> {
    const nativeSampleRate = this.context?.sampleRate ?? TARGET_SAMPLE_RATE;

    this.processor?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => {
      t.stop();
    });
    await this.context?.close();

    // Merge chunks
    const totalLength = this.chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    // Downsample from native rate to 24kHz if needed
    const resampled =
      nativeSampleRate === TARGET_SAMPLE_RATE
        ? merged
        : downsample(merged, nativeSampleRate, TARGET_SAMPLE_RATE);

    // Convert Float32 [-1, 1] → Int16
    const int16 = new Int16Array(resampled.length);
    for (let i = 0; i < resampled.length; i++) {
      const clamped = Math.max(-1, Math.min(1, resampled[i]));
      int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }

    // Base64 encode
    const bytes = new Uint8Array(int16.buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    this.chunks = [];
    this.context = null;
    this.stream = null;
    this.source = null;
    this.processor = null;

    return btoa(binary);
  }
}

function downsample(
  buffer: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  const ratio = fromRate / toRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const lo = Math.floor(srcIndex);
    const hi = Math.min(lo + 1, buffer.length - 1);
    const frac = srcIndex - lo;
    result[i] = buffer[lo] * (1 - frac) + buffer[hi] * frac;
  }
  return result;
}
