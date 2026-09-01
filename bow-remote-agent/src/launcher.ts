/**
 * Application Launcher
 * Launches and manages applications
 */

import { Logger, ToolResult, getCurrentTimestamp } from "@bow/shared";
import { spawn, exec } from "child_process";
import { platform } from "os";

export interface LaunchOptions {
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    detached?: boolean;
    waitForWindow?: boolean;
    windowTimeoutMs?: number;
}

export class ApplicationLauncher {
    private logger: Logger;
    private os: string = platform();
    private runningProcesses: Map<string, number> = new Map(); // name -> pid

    constructor(logger: Logger) {
        this.logger = logger;
    }

    async launch(name: string, options?: LaunchOptions): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            this.logger.debug("Launching application", { name, options });
            if (!name.trim() || !/^[\w .-]+$/.test(name.trim())) throw new Error("Invalid application name");

            const executable = this.resolveAlias(name);
            const child = this.os === "win32"
                ? spawn("cmd.exe", ["/d", "/c", "start", "", "/b", executable, ...(options?.args || [])], {
                    cwd: options?.cwd,
                    env: options?.env ? { ...process.env, ...options.env } : process.env,
                    detached: true, stdio: "ignore", windowsHide: false,
                })
                : spawn(executable, options?.args || [], {
                cwd: options?.cwd,
                env: options?.env ? { ...process.env, ...options.env } : process.env,
                detached: options?.detached !== false,
                stdio: "ignore",
                shell: false,
            });
            child.unref();
            if (child.pid) this.runningProcesses.set(executable.toLowerCase(), child.pid);
            if (options?.waitForWindow && !(await this.wait(executable, options.windowTimeoutMs || 30000))) throw new Error(`Application window/process was not detected: ${name}`);
            return {
                success: true,
                action: "open_application",
                result: { name, executable, launched: true, pid: child.pid, verified: options?.waitForWindow === true },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                action: "open_application",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async launchChrome(url?: string): Promise<ToolResult> {
        const args = url ? [url] : [];
        const browserName = this.os === "win32" ? "chrome" : "google-chrome";
        return this.launch(browserName, { args });
    }

    async launchFirefox(url?: string): Promise<ToolResult> {
        const args = url ? [url] : [];
        const browserName = this.os === "win32" ? "firefox" : "firefox";
        return this.launch(browserName, { args });
    }

    async launchVSCode(path?: string): Promise<ToolResult> {
        const args = path ? [path] : [];
        return this.launch("code", { args });
    }

    async launchTerminal(): Promise<ToolResult> {
        let terminalApp: string;
        switch (this.os) {
            case "win32":
                terminalApp = "cmd";
                break;
            case "darwin":
                terminalApp = "open";
                break;
            default:
                terminalApp = "x-terminal-emulator";
        }
        return this.launch(terminalApp);
    }

    async launchCalculator(): Promise<ToolResult> {
        const app = this.os === "win32" ? "calc" : "gnome-calculator";
        return this.launch(app);
    }

    async launchFileManager(): Promise<ToolResult> {
        let app: string;
        switch (this.os) {
            case "win32":
                app = "explorer";
                break;
            case "darwin":
                app = "Finder";
                break;
            default:
                app = "nautilus";
        }
        return this.launch(app);
    }

    async close(name: string): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            this.logger.debug("Closing application", { name });

            const executable = this.resolveAlias(name);
            await new Promise<void>((resolve, reject) => {
                exec(this.os === "win32" ? `taskkill /IM "${executable}.exe" /T /F` : `pkill -f "${executable}"`, (error) => error ? reject(error) : resolve());
            });
            this.runningProcesses.delete(executable.toLowerCase());

            return {
                success: true,
                action: "close_application",
                result: { name, executable, closed: true, verified: !(await this.isRunning(executable)) },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                action: "close_application",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async listRunning(): Promise<string[]> {
        if (this.os === "win32") {
            const output = await new Promise<string>((resolve, reject) => exec("tasklist /FO CSV /NH", (error, stdout) => error ? reject(error) : resolve(stdout)));
            return output.split(/\r?\n/).filter(Boolean).map((line) => line.split(",")[0].replace(/^"|"$/g, "").replace(/\.exe$/i, ""));
        }
        return Array.from(this.runningProcesses.keys());
    }

    async isRunning(name: string): Promise<boolean> {
        const executable = this.resolveAlias(name);
        if (this.os === "win32") return new Promise((resolve) => exec(`tasklist /FI "IMAGENAME eq ${executable}.exe" /NH`, (_, stdout) => resolve(!/No tasks are running/i.test(stdout) && stdout.toLowerCase().includes(executable.toLowerCase()))));
        return this.runningProcesses.has(executable.toLowerCase());
    }

    async wait(name: string, timeoutMs: number = 30000): Promise<boolean> {
        // TODO: Wait for application to appear
        // Monitor running processes and wait for match
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            if (await this.isRunning(name)) {
                return true;
            }
            await this.sleep(500);
        }

        return false;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async focusWindow(name: string): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            if (this.os !== "win32") throw new Error("Window focus currently requires Windows");
            const focused = await new Promise<boolean>((resolve) => exec(`powershell.exe -NoProfile -Command "$s=New-Object -ComObject WScript.Shell; [bool]$s.AppActivate('${name.replace(/'/g, "''")}')"`, (error, stdout) => resolve(!error && stdout.trim().toLowerCase() === "true")));
            if (!focused) throw new Error(`Window was not found: ${name}`);
            return { success: true, action: "focus_window", result: { name, verified: true }, timestamp: getCurrentTimestamp(), duration: Date.now() - startTime };
        } catch (error) { return { success: false, action: "focus_window", error: error instanceof Error ? error.message : String(error), recoverable: true, timestamp: getCurrentTimestamp(), duration: Date.now() - startTime }; }
    }

    async getWindows(): Promise<Array<{ process: string; title: string }>> {
        if (this.os !== "win32") return [];
        return new Promise((resolve) => exec("powershell.exe -NoProfile -Command \"Get-Process | Where-Object {$_.MainWindowTitle} | Select-Object ProcessName,MainWindowTitle | ConvertTo-Json -Compress\"", (_, stdout) => {
            try { const parsed = JSON.parse(stdout || "[]"); resolve((Array.isArray(parsed) ? parsed : [parsed]).map((item) => ({ process: item.ProcessName, title: item.MainWindowTitle }))); } catch { resolve([]); }
        }));
    }

    private resolveAlias(name: string): string {
        const normalized = name.trim().toLowerCase().replace(/\.exe$/, "");
        const aliases: Record<string, string> = { "google chrome": "chrome", browser: "chrome", chrome: "chrome", notepad: "notepad", calculator: "calc", calc: "calc", terminal: "cmd", "file explorer": "explorer", explorer: "explorer", vscode: "code", "vs code": "code" };
        return aliases[normalized] || normalized;
    }
}

export default ApplicationLauncher;
