import { AudioMimeType, Logger, SpeechOptions } from "@bow/shared";
export interface EdgeTTSConfig {
    defaultVoice?: string;
    rate?: string;
    pitch?: string;
}
export declare class EdgeTTSSpeechProvider {
    private readonly logger;
    private readonly defaultVoice;
    constructor(logger: Logger, config?: EdgeTTSConfig);
    /**
     * Synthesize text to Vietnamese speech audio buffer (MP3 format) using Microsoft Edge Neural TTS
     */
    synthesize(text: string, options?: SpeechOptions): Promise<{
        audio: Buffer;
        mimeType: AudioMimeType;
    }>;
}
export default EdgeTTSSpeechProvider;
//# sourceMappingURL=edgeTts.d.ts.map