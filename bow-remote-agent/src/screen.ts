/**
 * Screen Controller
 * Captures screenshots and reads screen information
 */

import { Logger, Screenshot, ScreenInfo, ToolResult, getCurrentTimestamp } from "@bow/shared";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { isWindows, runPowerShell, psQuote } from "./windows.js";

export class ScreenController {
    private logger: Logger;
    private width: number = 1920;
    private height: number = 1080;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    async takeScreenshot(): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            this.logger.debug("Taking screenshot");

            if (!isWindows()) throw new Error("Screenshot currently requires Windows");
            const file = path.join(os.tmpdir(), `bow-screen-${crypto.randomUUID()}.png`);
            const dimensions = await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms; $b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; "$($b.Width),$($b.Height)"`);
            const [width, height] = dimensions.split(",").map(Number);
            await runPowerShell(`Add-Type -AssemblyName System.Drawing; Add-Type -AssemblyName System.Windows.Forms; $b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height; $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size); $bmp.Save(${psQuote(file)},[System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose()`, 30000);
            const data = await fs.readFile(file);
            await fs.rm(file, { force: true });
            const screenshotData: Screenshot = {
                data,
                width,
                height,
                mimeType: "image/png",
                timestamp: getCurrentTimestamp(),
            };

            return {
                success: true,
                action: "screenshot",
                result: {
                    width: screenshotData.width,
                    height: screenshotData.height,
                    mimeType: screenshotData.mimeType,
                    size: screenshotData.data.length,
                    data: screenshotData.data.toString("base64"),
                },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                action: "screenshot",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async getScreenInfo(): Promise<ScreenInfo> {
        const startTime = Date.now();
        try {
            this.logger.debug("Getting screen info");

            // TODO: Implement screen analysis
            // 1. Capture screenshot
            // 2. Run OCR
            // 3. Detect UI elements
            // 4. Return structured info

            const info: ScreenInfo = {
                width: this.width,
                height: this.height,
                text: [],
                elements: [],
                timestamp: getCurrentTimestamp(),
            };

            return info;
        } catch (error) {
            this.logger.error("Error getting screen info", error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    async getScreenDimensions(): Promise<{ width: number; height: number }> {
        if (isWindows()) {
            const output = await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms; $b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; "$($b.Width),$($b.Height)"`);
            const [width, height] = output.split(",").map(Number); return { width, height };
        }
        return { width: this.width, height: this.height };
    }

    async getDisplayCount(): Promise<number> {
        // TODO: Get number of displays from OS
        return 1;
    }

    async waitForChange(timeoutMs: number = 5000): Promise<boolean> {
        // TODO: Monitor screen for changes
        // Compare screenshots at intervals
        // Return true if change detected, false on timeout
        return false;
    }

    setDimensions(width: number, height: number): void {
        this.width = width;
        this.height = height;
        this.logger.debug("Screen dimensions set", { width, height });
    }
}

export default ScreenController;
