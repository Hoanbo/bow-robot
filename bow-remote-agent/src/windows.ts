import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export function isWindows(): boolean { return process.platform === "win32"; }

export async function runPowerShell(script: string, timeout = 30000): Promise<string> {
    if (!isWindows()) throw new Error("This operation requires Windows");
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], { windowsHide: true, timeout });
    return stdout.trim();
}

export function psQuote(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
}
