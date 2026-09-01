import { AudioMimeType, Logger } from "@bow/shared";

export interface WhisperConfig {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    language?: string;
}

export class WhisperSTTProvider {
    private readonly logger: Logger;
    private readonly config: WhisperConfig;

    constructor(logger: Logger, config: WhisperConfig = {}) {
        this.logger = logger;
        this.config = {
            apiKey: config.apiKey || process.env.STT_API_KEY || "",
            baseUrl: config.baseUrl || process.env.STT_BASE_URL || "https://api.openai.com/v1",
            model: config.model || process.env.STT_MODEL || "whisper-1",
            language: config.language || "vi",
        };
    }

    /**
     * Transcribe Vietnamese audio buffer to text
     */
    async transcribe(audio: Buffer, fileName = "speech.wav", mimeType: AudioMimeType = "audio/wav", language = "vi"): Promise<string> {
        if (!audio || audio.length === 0) {
            throw new Error("Empty audio buffer received for transcription");
        }

        const baseUrl = this.config.baseUrl || "https://api.openai.com/v1";
        const isLocalFasterWhisper = baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");

        const form = new FormData();
        form.append("file", new Blob([audio], { type: mimeType }), fileName);
        form.append("model", this.config.model || "whisper-1");
        form.append("language", language || this.config.language || "vi");

        const headers: Record<string, string> = {};
        if (this.config.apiKey && !isLocalFasterWhisper) {
            headers["Authorization"] = `Bearer ${this.config.apiKey}`;
        }

        try {
            const response = await fetch(`${baseUrl}/audio/transcriptions`, {
                method: "POST",
                headers,
                body: form,
            });

            if (!response.ok) {
                const errText = await response.text();
                this.logger.warn(`Whisper STT request failed (${response.status}): ${errText}`);
                throw new Error(`Whisper STT request failed (${response.status}): ${errText}`);
            }

            const data = (await response.json()) as { text?: string };
            const text = (data.text || "").trim();
            this.logger.debug("Vietnamese audio transcribed successfully", {
                text,
                chars: text.length,
                audioBytes: audio.length,
            });
            return text;
        } catch (err: any) {
            this.logger.error("Whisper STT error", err);
            throw err;
        }
    }
}

export default WhisperSTTProvider;
