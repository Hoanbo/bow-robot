/**
 * Screen Controller V4.0
 * Captures screenshots, runs OCR screen vision, and inspects desktop notifications
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
                width: width || this.width,
                height: height || this.height,
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

    async inspectScreenOcr(): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            this.logger.debug("Running inspect_screen_ocr");

            if (!isWindows()) throw new Error("OCR inspection currently requires Windows");

            // Windows UI & Active Windows Title/Text extraction script
            const psScript = `
                $windows = Get-Process | Where-Object { $_.MainWindowTitle -ne "" } | Select-Object -Property ProcessName, MainWindowTitle, Id;
                $windows | ConvertTo-Json -Compress
            `;
            const rawJson = await runPowerShell(psScript, 10000);
            let windowsList: Array<{ ProcessName: string; MainWindowTitle: string; Id: number }> = [];
            try {
                const parsed = JSON.parse(rawJson);
                windowsList = Array.isArray(parsed) ? parsed : [parsed];
            } catch {
                windowsList = [];
            }

            const visibleTexts = windowsList.map((w) => `[${w.ProcessName}] ${w.MainWindowTitle}`);

            return {
                success: true,
                action: "inspect_screen_ocr",
                result: {
                    activeWindows: windowsList,
                    extractedText: visibleTexts,
                    count: windowsList.length,
                    timestamp: getCurrentTimestamp(),
                },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                action: "inspect_screen_ocr",
                error: error instanceof Error ? error.message : "OCR inspection failed",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async inspectScreenNotifications(): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            this.logger.debug("Running inspect_screen_notifications");

            if (!isWindows()) throw new Error("Notification inspection requires Windows");

            // Inspect notifications and top-level chat/toast windows (Zalo, Telegram, Messenger, Chrome notifications)
            const psScript = `
                $notifs = Get-Process | Where-Object { 
                    $_.MainWindowTitle -ne "" -and 
                    ($_.ProcessName -match "zalo|telegram|messenger|whatsapp|slack|skype|chrome|msedge" -or 
                     $_.MainWindowTitle -match "thông báo|tin nhắn|message|notification|chat")
                } | Select-Object -Property ProcessName, MainWindowTitle, Id;
                $notifs | ConvertTo-Json -Compress
            `;
            const rawJson = await runPowerShell(psScript, 8000);
            let notifs: any[] = [];
            try {
                const parsed = JSON.parse(rawJson);
                notifs = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
            } catch {
                notifs = [];
            }

            return {
                success: true,
                action: "inspect_screen_notifications",
                result: {
                    notifications: notifs.map((n) => `App: ${n.ProcessName}, Title: ${n.MainWindowTitle}`),
                    activeAppCount: notifs.length,
                    timestamp: getCurrentTimestamp(),
                },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                action: "inspect_screen_notifications",
                error: error instanceof Error ? error.message : "Notification inspection failed",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async getScreenInfo(): Promise<ScreenInfo> {
        try {
            this.logger.debug("Getting screen info");

            const ocrResult = await this.inspectScreenOcr();
            const notifResult = await this.inspectScreenNotifications();
            const dims = await this.getScreenDimensions();

            const info: ScreenInfo = {
                width: dims.width,
                height: dims.height,
                text: (ocrResult.result as any)?.extractedText || [],
                elements: [],
                notifications: (notifResult.result as any)?.notifications || [],
                timestamp: getCurrentTimestamp(),
            };

            return info;
        } catch (error) {
            this.logger.error("Error getting screen info", error instanceof Error ? error : new Error(String(error)));
            return {
                width: this.width,
                height: this.height,
                text: [],
                elements: [],
                timestamp: getCurrentTimestamp(),
            };
        }
    }

    async getScreenDimensions(): Promise<{ width: number; height: number }> {
        if (isWindows()) {
            try {
                const output = await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms; $b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; "$($b.Width),$($b.Height)"`);
                const [width, height] = output.split(",").map(Number);
                if (width && height) {
                    this.width = width;
                    this.height = height;
                    return { width, height };
                }
            } catch {}
        }
        return { width: this.width, height: this.height };
    }

    async getDisplayCount(): Promise<number> {
        return 1;
    }

    async waitForChange(timeoutMs: number = 5000): Promise<boolean> {
        return false;
    }

    setDimensions(width: number, height: number): void {
        this.width = width;
        this.height = height;
        this.logger.debug("Screen dimensions set", { width, height });
    }
}

export default ScreenController;
