export interface VisionElement {
    label: string;
    confidence: number;
    bounds?: { x: number; y: number; width: number; height: number };
}

export interface VisionAnalysis {
    description: string;
    elements: VisionElement[];
    provider: string;
    timestamp: string;
}

export interface VisionProvider {
    analyzeScreenshot(image: Buffer, mimeType: string, prompt?: string): Promise<VisionAnalysis>;
}
