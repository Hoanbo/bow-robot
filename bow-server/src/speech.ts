import { AudioMimeType, Logger, SpeechOptions, SpeechProvider } from "@bow/shared";

interface OpenAISpeechConfig {
    sttApiKey: string;
    ttsApiKey: string;
    sttModel: string;
    ttsModel: string;
    ttsVoice: string;
    baseUrl?: string;
}

/** OpenAI REST adapter. The rest of BOW only depends on SpeechProvider. */
export class OpenAISpeechProvider implements SpeechProvider {
    private readonly logger: Logger;
    private readonly config: Required<OpenAISpeechConfig>;

    constructor(logger: Logger, config: OpenAISpeechConfig) {
        this.logger = logger;
        this.config = {
            baseUrl: "https://api.openai.com/v1",
            ...config,
        };
    }

    async transcribe(audio: Buffer, fileName: string, mimeType: AudioMimeType, language?: string): Promise<string> {
        if (!this.config.sttApiKey) throw new Error("STT_API_KEY is not configured");

        const form = new FormData();
        form.append("file", new Blob([audio], { type: mimeType }), fileName);
        form.append("model", this.config.sttModel);
        if (language) form.append("language", language);

        const response = await fetch(`${this.config.baseUrl}/audio/transcriptions`, {
            method: "POST",
            headers: { Authorization: `Bearer ${this.config.sttApiKey}` },
            body: form,
        });
        if (!response.ok) throw new Error(`STT request failed (${response.status}): ${await response.text()}`);
        const data = (await response.json()) as { text?: string };
        this.logger.debug("Audio transcribed", { characters: data.text?.length || 0, model: this.config.sttModel });
        return data.text || "";
    }

    async synthesize(text: string, options: SpeechOptions = {}): Promise<{ audio: Buffer; mimeType: AudioMimeType }> {
        if (!this.config.ttsApiKey) throw new Error("TTS_API_KEY is not configured");
        if (!text.trim()) throw new Error("Cannot synthesize empty text");

        const response = await fetch(`${this.config.baseUrl}/audio/speech`, {
            method: "POST",
            headers: { Authorization: `Bearer ${this.config.ttsApiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: this.config.ttsModel,
                input: text.slice(0, 4096),
                voice: options.voice || this.config.ttsVoice,
                speed: options.speed || 1,
                response_format: "wav",
            }),
        });
        if (!response.ok) throw new Error(`TTS request failed (${response.status}): ${await response.text()}`);
        return { audio: Buffer.from(await response.arrayBuffer()), mimeType: "audio/wav" };
    }
}
