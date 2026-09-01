import { Logger } from "@bow/shared";
import AudioController from "./audio.js";

export interface VoiceSessionOptions {
    serverHost: string;
    serverPort: number;
    token: string;
    sessionId: string;
    listenDurationMs?: number;
}

/** Push-to-talk-ready voice turn orchestration over the existing HTTP API. */
export class VoiceSession {
    constructor(private readonly logger: Logger, private readonly audio: AudioController, private readonly options: VoiceSessionOptions) {}

    async runTurn(): Promise<string> {
        const base = `http://${this.options.serverHost}:${this.options.serverPort}`;
        this.logger.info("Listening on headset microphone");
        const recording = await this.audio.listen(this.options.listenDurationMs || 5000);
        const transcription = await fetch(`${base}/speech/transcribe`, { method: "POST", headers: { Authorization: `Bearer ${this.options.token}`, "Content-Type": "audio/wav" }, body: recording });
        if (!transcription.ok) throw new Error(`Transcription failed: ${await transcription.text()}`);
        const { text } = await transcription.json() as { text: string };
        if (!text?.trim()) return "";

        const response = await fetch(`${base}/agent/query`, { method: "POST", headers: { Authorization: `Bearer ${this.options.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: text, sessionId: this.options.sessionId }) });
        if (!response.ok) throw new Error(`Agent query failed: ${await response.text()}`);
        const turn = await response.json() as { response?: string };
        const reply = turn.response || "Mình chưa có câu trả lời.";

        const speech = await fetch(`${base}/speech/synthesize`, { method: "POST", headers: { Authorization: `Bearer ${this.options.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ text: reply }) });
        if (!speech.ok) throw new Error(`Speech synthesis failed: ${await speech.text()}`);
        await this.audio.play(Buffer.from(await speech.arrayBuffer()));
        return reply;
    }
}

export default VoiceSession;
