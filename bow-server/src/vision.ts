import { getCurrentTimestamp, Logger, VisionAnalysis, VisionProvider } from "@bow/shared";

/** Safe baseline provider. It validates/records screenshots until a cloud/local vision provider is configured. */
export class MetadataVisionProvider implements VisionProvider {
    constructor(private readonly logger: Logger) {}

    async analyzeScreenshot(image: Buffer, mimeType: string, prompt?: string): Promise<VisionAnalysis> {
        if (!image.length) throw new Error("Screenshot is empty");
        const result: VisionAnalysis = {
            description: `Screenshot received (${mimeType}, ${image.length} bytes)${prompt ? `; prompt: ${prompt}` : ""}`,
            elements: [],
            provider: "metadata",
            timestamp: getCurrentTimestamp(),
        };
        this.logger.debug("Screenshot analyzed", { bytes: image.length, provider: result.provider });
        return result;
    }
}
