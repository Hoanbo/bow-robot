/**
 * Mouse Controller
 * Controls mouse movement, clicks, and scrolling
 */

import { Logger, ToolResult, getCurrentTimestamp } from "@bow/shared";
import { isWindows, runPowerShell } from "./windows.js";

export interface MousePosition {
    x: number;
    y: number;
}

export class MouseController {
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    async moveTo(x: number, y: number): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            this.logger.debug("Moving mouse", { x, y });

            if (!isWindows()) throw new Error("Mouse control currently requires Windows");
            if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) throw new Error("Mouse coordinates must be finite and non-negative");
            const bounds = await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms; $b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; "$($b.Width),$($b.Height)"`);
            const [width, height] = bounds.split(",").map(Number);
            if (x >= width || y >= height) throw new Error(`Mouse coordinates outside screen bounds ${width}x${height}`);
            await runPowerShell(`Add-Type @'\nusing System; using System.Runtime.InteropServices;\npublic static class BowMouse { [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y); }\n'@; [BowMouse]::SetCursorPos(${Math.round(x)}, ${Math.round(y)}) | Out-Null`);

            return {
                success: true,
                action: "mouse_move",
                result: { x, y },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                action: "mouse_move",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async click(x: number, y: number, button: "left" | "right" | "middle" = "left"): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            this.logger.debug("Mouse click", { x, y, button });

            await this.moveTo(x, y);
            const flags = button === "right" ? "0x0008,0x0010" : button === "middle" ? "0x0020,0x0040" : "0x0002,0x0004";
            await runPowerShell(`Add-Type @'\nusing System; using System.Runtime.InteropServices;\npublic static class BowClick { [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, UIntPtr e); }\n'@; [BowClick]::mouse_event(${flags.split(",")[0]},0,0,0,[UIntPtr]::Zero); [BowClick]::mouse_event(${flags.split(",")[1]},0,0,0,[UIntPtr]::Zero)`);

            return {
                success: true,
                action: "mouse_click",
                result: { x, y, button },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                action: "mouse_click",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async doubleClick(x: number, y: number): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            this.logger.debug("Double click", { x, y });

            await this.click(x, y); await new Promise((resolve) => setTimeout(resolve, 80)); await this.click(x, y);

            return {
                success: true,
                action: "mouse_double_click",
                result: { x, y },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                action: "mouse_double_click",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async rightClick(x: number, y: number): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            this.logger.debug("Right click", { x, y });

            // TODO: Implement right click
            return this.click(x, y, "right");
        } catch (error) {
            return {
                success: false,
                action: "mouse_right_click",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async scroll(direction: "up" | "down", amount: number = 3): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            this.logger.debug("Scroll", { direction, amount });

            if (!isWindows()) throw new Error("Mouse control currently requires Windows");
            const delta = (direction === "up" ? 1 : -1) * Math.max(1, Math.round(amount)) * 120;
            await runPowerShell(`Add-Type @'\nusing System; using System.Runtime.InteropServices;\npublic static class BowWheel { [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, int d, UIntPtr e); }\n'@; [BowWheel]::mouse_event(0x0800,0,0,${delta},[UIntPtr]::Zero)`);

            return {
                success: true,
                action: "scroll",
                result: { direction, amount },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                action: "scroll",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async drag(fromX: number, fromY: number, toX: number, toY: number): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            this.logger.debug("Drag", { fromX, fromY, toX, toY });

            // TODO: Implement mouse drag
            // 1. Move to start position
            // 2. Press left button
            // 3. Move to end position
            // 4. Release button

            return {
                success: true,
                action: "mouse_drag",
                result: { from: { x: fromX, y: fromY }, to: { x: toX, y: toY } },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                action: "mouse_drag",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async getPosition(): Promise<MousePosition> {
        const output = await runPowerShell(`Add-Type @'\nusing System; using System.Runtime.InteropServices;\npublic struct BowPoint { public int X; public int Y; }\npublic static class BowPosition { [DllImport("user32.dll")] public static extern bool GetCursorPos(out BowPoint p); }\n'@; $p=New-Object BowPoint; [BowPosition]::GetCursorPos([ref]$p) | Out-Null; "$($p.X),$($p.Y)"`);
        const [x, y] = output.split(",").map(Number); return { x, y };
    }
}

export default MouseController;
