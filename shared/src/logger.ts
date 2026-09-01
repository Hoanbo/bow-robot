/**
 * Centralized Logging System for BOW ROBOT V1
 * Supports file and console output with configurable levels
 */

import { LogEntry, LogLevel } from "./types.js";
import fs from "fs";
import path from "path";

export class Logger {
    private static instance: Logger;
    private logFile?: string;
    private logLevel: LogLevel;
    private category: string;
    private context: Map<string, string> = new Map();

    private static readonly LEVEL_HIERARCHY: Record<LogLevel, number> = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3,
        fatal: 4,
    };

    private constructor(
        category: string,
        logLevel: LogLevel = "info",
        logFile?: string
    ) {
        this.category = category;
        this.logLevel = logLevel;
        this.logFile = logFile;

        if (this.logFile) {
            const dir = path.dirname(this.logFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
    }

    static getInstance(
        category: string,
        logLevel: LogLevel = "info",
        logFile?: string
    ): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger(category, logLevel, logFile);
        }
        return Logger.instance;
    }

    static create(
        category: string,
        logLevel: LogLevel = "info",
        logFile?: string
    ): Logger {
        return new Logger(category, logLevel, logFile);
    }

    setContext(key: string, value: string): this {
        this.context.set(key, value);
        return this;
    }

    clearContext(): this {
        this.context.clear();
        return this;
    }

    getContext(): Record<string, string> {
        return Object.fromEntries(this.context);
    }

    private shouldLog(level: LogLevel): boolean {
        return (
            Logger.LEVEL_HIERARCHY[level] >= Logger.LEVEL_HIERARCHY[this.logLevel]
        );
    }

    private createEntry(
        level: LogLevel,
        message: string,
        data?: Record<string, unknown>,
        error?: Error
    ): LogEntry {
        return {
            timestamp: new Date().toISOString(),
            level,
            category: this.category,
            message,
            data: { ...this.getContext(), ...data },
            error: error
                ? {
                    code: error.name || "UNKNOWN",
                    message: error.message,
                    stack: error.stack,
                }
                : undefined,
        };
    }

    private writeLog(entry: LogEntry): void {
        // Console output with color coding
        const colorCode = this.getColorCode(entry.level);
        const contextStr =
            Object.keys(entry.data || {}).length > 0
                ? ` ${JSON.stringify(entry.data)}`
                : "";
        const errorStr = entry.error
            ? `\n  Error: ${entry.error.code}: ${entry.error.message}\n  Stack: ${entry.error.stack}`
            : "";

        console.log(
            `${colorCode}[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.category}] ${entry.message}${contextStr}${errorStr}\x1b[0m`
        );

        // File output
        if (this.logFile) {
            try {
                const logLine =
                    JSON.stringify(entry) + "\n";
                fs.appendFileSync(this.logFile, logLine);
            } catch (err) {
                console.error("Failed to write to log file:", err);
            }
        }
    }

    private getColorCode(level: LogLevel): string {
        switch (level) {
            case "debug":
                return "\x1b[36m"; // Cyan
            case "info":
                return "\x1b[32m"; // Green
            case "warn":
                return "\x1b[33m"; // Yellow
            case "error":
                return "\x1b[31m"; // Red
            case "fatal":
                return "\x1b[35m"; // Magenta
            default:
                return "\x1b[0m";
        }
    }

    debug(message: string, data?: Record<string, unknown>): void {
        if (this.shouldLog("debug")) {
            this.writeLog(this.createEntry("debug", message, data));
        }
    }

    info(message: string, data?: Record<string, unknown>): void {
        if (this.shouldLog("info")) {
            this.writeLog(this.createEntry("info", message, data));
        }
    }

    warn(message: string, data?: Record<string, unknown>): void {
        if (this.shouldLog("warn")) {
            this.writeLog(this.createEntry("warn", message, data));
        }
    }

    error(message: string, error?: Error, data?: Record<string, unknown>): void {
        if (this.shouldLog("error")) {
            this.writeLog(this.createEntry("error", message, data, error));
        }
    }

    fatal(message: string, error?: Error, data?: Record<string, unknown>): void {
        if (this.shouldLog("fatal")) {
            this.writeLog(this.createEntry("fatal", message, data, error));
        }
    }

    child(category: string): Logger {
        const childLogger = new Logger(
            `${this.category}:${category}`,
            this.logLevel,
            this.logFile
        );
        childLogger.context = new Map(this.context);
        return childLogger;
    }
}

export default Logger;
