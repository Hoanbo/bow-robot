import { Logger, ToolResult, getCurrentTimestamp } from "@bow/shared";
import { exec } from "child_process";

export interface BowTestOptions { command?: string; cwd?: string; timeoutMs?: number; }

export class BowTestRunner {
    constructor(private readonly logger: Logger) {}

    async run(options: BowTestOptions = {}): Promise<ToolResult> {
        const start = Date.now();
        const command = options.command || process.env.BOW_TEST_COMMAND;
        if (!command) return { success: false, action: "bow_test", error: "BOW_TEST_COMMAND is not configured", recoverable: true, timestamp: getCurrentTimestamp(), duration: Date.now() - start };
        return new Promise((resolve) => exec(command, { cwd: options.cwd, timeout: options.timeoutMs || 120000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
            const exitCode = error && typeof (error as NodeJS.ErrnoException & { code?: number }).code === "number" ? Number((error as any).code) : error ? 1 : 0;
            this.logger.info("BOW TEST completed", { exitCode, duration: Date.now() - start });
            resolve({ success: exitCode === 0, action: "bow_test", result: { command, stdout, stderr, exitCode }, error: exitCode === 0 ? undefined : error?.message, recoverable: exitCode !== 0, timestamp: getCurrentTimestamp(), duration: Date.now() - start });
        }));
    }
}

export default BowTestRunner;
