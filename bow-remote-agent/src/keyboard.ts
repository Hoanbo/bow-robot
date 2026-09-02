/**
 * Keyboard Controller V4.0
 * Controls keyboard input, key presses, safe chat replies (Zalo/Telegram/Facebook), and text typing
 */

import { Logger, ToolResult, getCurrentTimestamp } from "@bow/shared";
import { isWindows, runPowerShell, psQuote } from "./windows.js";

export type KeyModifier = "ctrl" | "shift" | "alt" | "meta";

export class KeyboardController {
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    async type(text: string, delayMs: number = 50): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            this.logger.debug("Typing text", { length: text.length });

            if (!isWindows()) throw new Error("Keyboard control currently requires Windows");
            if (text.length > 10000) throw new Error("Text input exceeds 10000 characters");
            const escaped = text.replace(/[+^%~(){}\[\]]/g, (character) => `{${character}}`);
            await runPowerShell(`$shell=New-Object -ComObject WScript.Shell; $shell.SendKeys(${psQuote(escaped)})`);
            if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 1000)));

            return {
                success: true,
                action: "keyboard_type",
                result: { text, length: text.length, delayMs },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                action: "keyboard_type",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    /**
     * Safe Unicode / Vietnamese typing via Clipboard paste to avoid SendKeys character corruption
     */
    async typeSafe(text: string): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            this.logger.debug("Safe typing via clipboard paste", { length: text.length });
            if (!isWindows()) throw new Error("Keyboard control currently requires Windows");

            const psScript = `
                Set-Clipboard -Value ${psQuote(text)};
                Start-Sleep -Milliseconds 50;
                $shell = New-Object -ComObject WScript.Shell;
                $shell.SendKeys('^v');
            `;
            await runPowerShell(psScript, 5000);

            return {
                success: true,
                action: "keyboard_type_safe",
                result: { text, length: text.length },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                action: "keyboard_type_safe",
                error: error instanceof Error ? error.message : "Safe typing failed",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    /**
     * Safe chat reply into active messaging window (Zalo, Telegram, Facebook Messenger)
     */
    async safeChatReply(text: string, sendEnter: boolean = true): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            this.logger.debug("Executing safe chat reply", { textLength: text.length, sendEnter });

            // 1. Paste text safely
            await this.typeSafe(text);

            // 2. Press Enter if requested
            if (sendEnter) {
                await new Promise((resolve) => setTimeout(resolve, 80));
                await this.press("Return");
            }

            return {
                success: true,
                action: "safe_chat_reply",
                result: { text, sent: sendEnter },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                action: "safe_chat_reply",
                error: error instanceof Error ? error.message : "Safe chat reply failed",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async press(
        key: string,
        modifiers?: KeyModifier[]
    ): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            this.logger.debug("Pressing key", { key, modifiers });

            if (!isWindows()) throw new Error("Keyboard control currently requires Windows");
            if (!/^[a-zA-Z0-9 ]$/.test(key) && !["Enter", "Return", "Escape", "Backspace", "Delete", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown", "Space"].includes(key)) throw new Error(`Unsupported key: ${key}`);
            const modifierMap: Record<KeyModifier, string> = { ctrl: "^", shift: "+", alt: "%", meta: "^" };
            const prefix = (modifiers || []).map((modifier) => modifierMap[modifier]).join("");
            const keyMap: Record<string, string> = { Enter: "{ENTER}", Return: "{ENTER}", Escape: "{ESC}", Backspace: "{BACKSPACE}", Delete: "{DELETE}", Tab: "{TAB}", ArrowUp: "{UP}", ArrowDown: "{DOWN}", ArrowLeft: "{LEFT}", ArrowRight: "{RIGHT}", Home: "{HOME}", End: "{END}", PageUp: "{PGUP}", PageDown: "{PGDN}", " ": " ", Space: " " };
            const encoded = keyMap[key] || key;
            await runPowerShell(`$shell=New-Object -ComObject WScript.Shell; $shell.SendKeys(${psQuote(prefix + encoded)})`);

            return {
                success: true,
                action: "keyboard_press",
                result: { key, modifiers },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                action: "keyboard_press",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async hotkey(key: string, modifiers: KeyModifier[]): Promise<ToolResult> {
        return this.press(key, modifiers);
    }

    async enter(): Promise<ToolResult> {
        return this.press("Return");
    }

    async escape(): Promise<ToolResult> {
        return this.press("Escape");
    }

    async backspace(count: number = 1): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            this.logger.debug("Backspace", { count });
            for (let i = 0; i < count; i++) {
                await this.press("Backspace");
            }

            return {
                success: true,
                action: "keyboard_backspace",
                result: { count },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                action: "keyboard_backspace",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async delete(count: number = 1): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            this.logger.debug("Delete", { count });
            for (let i = 0; i < count; i++) {
                await this.press("Delete");
            }

            return {
                success: true,
                action: "keyboard_delete",
                result: { count },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                action: "keyboard_delete",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async tab(): Promise<ToolResult> {
        return this.press("Tab");
    }

    async selectAll(): Promise<ToolResult> {
        return this.hotkey("a", ["ctrl"]);
    }

    async copy(): Promise<ToolResult> {
        return this.hotkey("c", ["ctrl"]);
    }

    async paste(): Promise<ToolResult> {
        return this.hotkey("v", ["ctrl"]);
    }

    async cut(): Promise<ToolResult> {
        return this.hotkey("x", ["ctrl"]);
    }

    async undo(): Promise<ToolResult> {
        return this.hotkey("z", ["ctrl"]);
    }

    async redo(): Promise<ToolResult> {
        return this.hotkey("z", ["ctrl", "shift"]);
    }

    async arrowUp(): Promise<ToolResult> {
        return this.press("ArrowUp");
    }

    async arrowDown(): Promise<ToolResult> {
        return this.press("ArrowDown");
    }

    async arrowLeft(): Promise<ToolResult> {
        return this.press("ArrowLeft");
    }

    async arrowRight(): Promise<ToolResult> {
        return this.press("ArrowRight");
    }

    async home(): Promise<ToolResult> {
        return this.press("Home");
    }

    async end(): Promise<ToolResult> {
        return this.press("End");
    }

    async pageUp(): Promise<ToolResult> {
        return this.press("PageUp");
    }

    async pageDown(): Promise<ToolResult> {
        return this.press("PageDown");
    }
}

export default KeyboardController;
