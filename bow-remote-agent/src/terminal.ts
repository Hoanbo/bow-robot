/**
 * Terminal Executor
 * Executes terminal/shell commands safely
 */

import { Logger, ToolResult, getCurrentTimestamp } from "@bow/shared";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import { platform } from "os";

const execAsync = promisify(exec);

// Whitelist of safe commands for V1
const SAFE_COMMANDS = [
    "echo", "pwd", "ls", "dir", "cd", "cat", "grep", "find", "which",
    "whoami", "date", "time", "cal", "uptime", "df", "du", "ps",
    "git", "npm", "node", "python", "ruby", "java", "dotnet",
    "curl", "wget", "ping", "tracert", "ipconfig", "ifconfig",
];

export interface CommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    command: string;
    duration: number;
}

export class TerminalExecutor {
    private logger: Logger;
    private os: string = platform();
    private allowedCommands: Set<string> = new Set(SAFE_COMMANDS);
    private maxOutputSize: number = 1000000; // 1MB

    constructor(logger: Logger) {
        this.logger = logger;
    }

    async execute(command: string, options: { cwd?: string; timeout?: number } = {}): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            this.logger.debug("Executing command", { command });

            // Check if command is safe
            const baseCommand = this.getBaseCommand(command);
            if (!this.isSafeCommand(baseCommand)) {
                throw new Error(`Command not allowed: ${baseCommand}`);
            }

            // TODO: In production, dangerous commands need CONFIRM permission
            const timeout = options.timeout || 30000;
            const cwd = options.cwd;

            // Execute command
            const { stdout, stderr } = await execAsync(command, {
                cwd,
                timeout,
                maxBuffer: this.maxOutputSize,
            });

            return {
                success: true,
                action: "terminal_execute",
                result: {
                    command,
                    stdout: stdout.substring(0, this.maxOutputSize),
                    stderr: stderr.substring(0, this.maxOutputSize),
                    exitCode: 0,
                    duration: Date.now() - startTime,
                },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            let exitCode = 1;
            let stdout = "";
            let stderr = "";

            if (error instanceof Error && "code" in error) {
                exitCode = (error as any).code || 1;
            }
            if (error instanceof Error && "stdout" in error) {
                stdout = (error as any).stdout || "";
            }
            if (error instanceof Error && "stderr" in error) {
                stderr = (error as any).stderr || "";
            }

            return {
                success: false,
                action: "terminal_execute",
                error: errorMsg,
                result: {
                    command,
                    stdout: stdout.substring(0, this.maxOutputSize),
                    stderr: stderr.substring(0, this.maxOutputSize),
                    exitCode,
                },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async executeScript(scriptContent: string, scriptType: "bash" | "powershell" = "bash"): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            this.logger.debug("Executing script", { type: scriptType });

            // TODO: Write script to temp file, execute, cleanup
            // This requires CONFIRM permission in production

            return {
                success: true,
                action: "terminal_script",
                result: { type: scriptType, executed: true },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                action: "terminal_script",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async getWorkingDirectory(): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            const cmd = this.os === "win32" ? "cd" : "pwd";
            const { stdout } = await execAsync(cmd);

            return {
                success: true,
                action: "terminal_pwd",
                result: { cwd: stdout.trim() },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                action: "terminal_pwd",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async listDirectory(dirPath: string = "."): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            const cmd = this.os === "win32" ? `dir "${dirPath}"` : `ls -la "${dirPath}"`;
            return await this.execute(cmd);
        } catch (error) {
            return {
                success: false,
                action: "terminal_ls",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async gitStatus(repoPath: string = "."): Promise<ToolResult> {
        return this.execute(`git -C "${repoPath}" status`);
    }

    async gitLog(repoPath: string = ".", lines: number = 10): Promise<ToolResult> {
        return this.execute(`git -C "${repoPath}" log -${lines}`);
    }

    async npmList(repoPath: string = "."): Promise<ToolResult> {
        return this.execute(`npm list`, { cwd: repoPath });
    }

    async npmInstall(repoPath: string = "."): Promise<ToolResult> {
        return this.execute(`npm install`, { cwd: repoPath, timeout: 120000 });
    }

    async getPlatform(): Promise<string> {
        return this.os;
    }

    private getBaseCommand(command: string): string {
        // Extract the base command from the full command
        // e.g., "npm install react" -> "npm"
        const parts = command.trim().split(/\s+/);
        return parts[0]?.toLowerCase() || "";
    }

    private isSafeCommand(command: string): boolean {
        return this.allowedCommands.has(command);
    }

    addAllowedCommand(command: string): void {
        this.allowedCommands.add(command.toLowerCase());
        this.logger.debug("Command allowed", { command });
    }

    removeAllowedCommand(command: string): void {
        this.allowedCommands.delete(command.toLowerCase());
        this.logger.debug("Command removed from allowed list", { command });
    }

    getAllowedCommands(): string[] {
        return Array.from(this.allowedCommands);
    }
}

export default TerminalExecutor;
