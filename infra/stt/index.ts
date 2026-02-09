export interface STTProvider {
  transcribe(pcm: Buffer, languageCode?: string): Promise<string>;
}

// Default provider: Gradium
export { transcribeAudio } from "./gradium";
