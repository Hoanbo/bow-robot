/** Shared speech/audio contracts used by the server and remote agent. */

export type AudioMimeType = "audio/wav" | "audio/webm" | "audio/mpeg" | "audio/ogg";

export interface SpeechOptions {
    language?: string;
    voice?: string;
    speed?: number;
}

export interface AudioDeviceConfig {
    inputDevice?: string;
    outputDevice?: string;
    sampleRate?: number;
    channels?: number;
}

export interface SpeechProvider {
    transcribe(audio: Buffer, fileName: string, mimeType: AudioMimeType, language?: string): Promise<string>;
    synthesize(text: string, options?: SpeechOptions): Promise<{ audio: Buffer; mimeType: AudioMimeType }>;
}
