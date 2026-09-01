import { AudioMimeType, Logger, SpeechOptions, SpeechProvider } from "@bow/shared";
import { EdgeTTSSpeechProvider } from "./speech/edgeTts.js";
import { WhisperSTTProvider } from "./speech/whisperStt.js";

export { EdgeTTSSpeechProvider } from "./speech/edgeTts.js";
export { WhisperSTTProvider } from "./speech/whisperStt.js";

export interface UnifiedSpeechConfig {
    sttProvider?: "whisper" | "faster-whisper" | "openai" | string;
    ttsProvider?: "edge-tts" | "openai" | string;
    sttApiKey?: string;
    ttsApiKey?: string;
    sttBaseUrl?: string;
    sttModel?: string;
    ttsModel?: string;
    ttsVoice?: string;
}

export class UnifiedSpeechProvider implements SpeechProvider {
    private readonly logger: Logger;
    private readonly edgeTts: EdgeTTSSpeechProvider;
    private readonly whisperStt: WhisperSTTProvider;
    private readonly config: UnifiedSpeechConfig;

    constructor(logger: Logger, config: UnifiedSpeechConfig = {}) {
        this.logger = logger;
        this.config = {
            ttsProvider: config.ttsProvider || "edge-tts",
            sttProvider: config.sttProvider || "whisper",
            ttsVoice: config.ttsVoice || "vi-VN-HoaiMyNeural",
            sttModel: config.sttModel || "whisper-1",
            ...config,
        };
        this.edgeTts = new EdgeTTSSpeechProvider(logger, { defaultVoice: this.config.ttsVoice });
        this.whisperStt = new WhisperSTTProvider(logger, {
            apiKey: this.config.sttApiKey,
            baseUrl: this.config.sttBaseUrl,
            model: this.config.sttModel,
        });
    }

    async transcribe(audio: Buffer, fileName = "speech.wav", mimeType: AudioMimeType = "audio/wav", language = "vi"): Promise<string> {
        return this.whisperStt.transcribe(audio, fileName, mimeType, language);
    }

    async synthesize(text: string, options: SpeechOptions = {}): Promise<{ audio: Buffer; mimeType: AudioMimeType }> {
        if (this.config.ttsProvider === "openai" && this.config.ttsApiKey) {
            // OpenAI TTS fallback
            const response = await fetch("https://api.openai.com/v1/audio/speech", {
                method: "POST",
                headers: { Authorization: `Bearer ${this.config.ttsApiKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: this.config.ttsModel || "tts-1",
                    input: text.slice(0, 4096),
                    voice: options.voice || this.config.ttsVoice || "alloy",
                    speed: options.speed || 1,
                    response_format: "mp3",
                }),
            });
            if (!response.ok) throw new Error(`OpenAI TTS request failed: ${await response.text()}`);
            return { audio: Buffer.from(await response.arrayBuffer()), mimeType: "audio/mpeg" };
        }

        // Default to Microsoft Edge Neural Vietnamese TTS (zero-cost, ultra-natural)
        return this.edgeTts.synthesize(text, {
            voice: options.voice || this.config.ttsVoice || "vi-VN-HoaiMyNeural",
            speed: options.speed,
        });
    }
}

/** Backward compatibility alias */
export class OpenAISpeechProvider extends UnifiedSpeechProvider {}

export default UnifiedSpeechProvider;
