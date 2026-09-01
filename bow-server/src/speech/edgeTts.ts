import { AudioMimeType, Logger, SpeechOptions } from "@bow/shared";
import WebSocket from "ws";
import crypto from "crypto";

const EDGE_TRUSTED_TOKEN = "6A5AA1D4EA65408183922687D3968330";
const EDGE_WS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaheadedge/v1?TrustedClientToken=${EDGE_TRUSTED_TOKEN}`;

export interface EdgeTTSConfig {
    defaultVoice?: string;
    rate?: string;
    pitch?: string;
}

export class EdgeTTSSpeechProvider {
    private readonly logger: Logger;
    private readonly defaultVoice: string;

    constructor(logger: Logger, config: EdgeTTSConfig = {}) {
        this.logger = logger;
        this.defaultVoice = config.defaultVoice || "vi-VN-HoaiMyNeural";
    }

    /**
     * Synthesize text to Vietnamese speech audio buffer (MP3 format) using Microsoft Edge Neural TTS
     */
    async synthesize(text: string, options: SpeechOptions = {}): Promise<{ audio: Buffer; mimeType: AudioMimeType }> {
        const cleanText = text.trim();
        if (!cleanText) throw new Error("Cannot synthesize empty text");

        const voice = options.voice || this.defaultVoice;
        const speed = options.speed ?? 1;
        // Convert speed multiplier to Edge TTS rate format (e.g. 1 -> "0%", 1.2 -> "+20%", 0.8 -> "-20%")
        const ratePercent = Math.round((speed - 1) * 100);
        const rateStr = `${ratePercent >= 0 ? "+" : ""}${ratePercent}%`;

        const connectionId = crypto.randomUUID().replace(/-/g, "");
        const wsUrl = `${EDGE_WS_URL}&ConnectionId=${connectionId}`;

        return new Promise((resolve, reject) => {
            const audioChunks: Buffer[] = [];
            let resolved = false;

            const timeoutTimer = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    try { ws.close(); } catch {}
                    reject(new Error("Edge TTS synthesis timed out"));
                }
            }, 15000);

            const ws = new WebSocket(wsUrl, {
                headers: {
                    "Pragma": "no-cache",
                    "Cache-Control": "no-cache",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
                    "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
                },
            });

            ws.on("open", () => {
                this.logger.debug("Edge TTS WebSocket connected", { voice, textLength: cleanText.length });

                // 1. Send speech config
                const speechConfig = {
                    context: {
                        synthesis: {
                            audio: {
                                metadataoptions: {
                                    sentenceBoundaryEnabled: "false",
                                    wordBoundaryEnabled: "false",
                                },
                                outputFormat: "audio-24khz-48kbitrate-mono-mp3",
                            },
                        },
                    },
                };

                const configMessage = `Content-Type:application/json;charset=utf-8\r\nPath:speech.config\r\n\r\n${JSON.stringify(speechConfig)}`;
                ws.send(configMessage);

                // 2. Send SSML request
                const requestId = crypto.randomUUID().replace(/-/g, "");
                const escapedText = cleanText
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");

                const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='vi-VN'>` +
                    `<voice name='${voice}'>` +
                    `<prosody rate='${rateStr}' pitch='0%'>${escapedText}</prosody>` +
                    `</voice>` +
                    `</speak>`;

                const ssmlMessage = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`;
                ws.send(ssmlMessage);
            });

            ws.on("message", (data: WebSocket.Data, isBinary: boolean) => {
                if (isBinary && Buffer.isBuffer(data)) {
                    // Binary audio response packet: header length (2 bytes big endian) + text header + audio bytes
                    if (data.length > 2) {
                        const headerLength = data.readUInt16BE(0);
                        if (data.length > 2 + headerLength) {
                            const audioData = data.subarray(2 + headerLength);
                            audioChunks.push(audioData);
                        }
                    }
                } else if (typeof data === "string" || Buffer.isBuffer(data)) {
                    const textMsg = data.toString();
                    if (textMsg.includes("Path:turn.end")) {
                        if (!resolved) {
                            resolved = true;
                            clearTimeout(timeoutTimer);
                            try { ws.close(); } catch {}
                            const finalBuffer = Buffer.concat(audioChunks);
                            this.logger.debug("Edge TTS synthesized successfully", {
                                totalBytes: finalBuffer.length,
                                voice,
                            });
                            resolve({
                                audio: finalBuffer,
                                mimeType: "audio/mpeg",
                            });
                        }
                    }
                }
            });

            ws.on("error", (err) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeoutTimer);
                    this.logger.warn("Edge TTS error, falling back or failing", { error: err.message });
                    reject(err);
                }
            });

            ws.on("close", () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeoutTimer);
                    if (audioChunks.length > 0) {
                        const finalBuffer = Buffer.concat(audioChunks);
                        resolve({
                            audio: finalBuffer,
                            mimeType: "audio/mpeg",
                        });
                    } else {
                        reject(new Error("Edge TTS closed connection without audio data"));
                    }
                }
            });
        });
    }
}

export default EdgeTTSSpeechProvider;
