/**
 * Utility Functions for BOW ROBOT V1
 */

import { v4 as uuidv4 } from "uuid";

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
    return uuidv4() as string;
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
    return uuidv4() as string;
}

/**
 * Generate a unique message ID
 */
export function generateMessageId(): string {
    return uuidv4() as string;
}

/**
 * Get current timestamp in ISO format
 */
export function getCurrentTimestamp(): string {
    return new Date().toISOString();
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: {
        maxRetries?: number;
        initialDelayMs?: number;
        maxDelayMs?: number;
        backoffFactor?: number;
    } = {}
): Promise<T> {
    const maxRetries = options.maxRetries ?? 3;
    const initialDelayMs = options.initialDelayMs ?? 100;
    const maxDelayMs = options.maxDelayMs ?? 10000;
    const backoffFactor = options.backoffFactor ?? 2;

    let lastError: Error | undefined;
    let delayMs = initialDelayMs;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (attempt < maxRetries) {
                await sleep(delayMs);
                delayMs = Math.min(delayMs * backoffFactor, maxDelayMs);
            }
        }
    }

    throw lastError || new Error("Max retries exceeded");
}

/**
 * Validate that a value matches a schema
 */
export function validateSchema(
    value: unknown,
    schema: { type: string; properties?: Record<string, unknown>; required?: string[] }
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (typeof value !== typeof {}) {
        errors.push(`Expected object, got ${typeof value}`);
        return { valid: false, errors };
    }

    const obj = value as Record<string, unknown>;

    if (schema.required) {
        for (const key of schema.required) {
            if (!(key in obj)) {
                errors.push(`Missing required field: ${key}`);
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, unknown>>(
    ...objects: Partial<T>[]
): T {
    const result: Record<string, unknown> = {};

    for (const obj of objects) {
        if (!obj) continue;

        for (const [key, value] of Object.entries(obj)) {
            if (
                value &&
                typeof value === "object" &&
                !Array.isArray(value) &&
                !(value instanceof Date) &&
                !(value instanceof Buffer)
            ) {
                result[key] = deepMerge(
                    (result[key] as Record<string, unknown>) || {},
                    value as Record<string, unknown>
                );
            } else {
                result[key] = value;
            }
        }
    }

    return result as T;
}

/**
 * Check if a value is a plain object
 */
export function isPlainObject(value: unknown): boolean {
    return (
        typeof value === "object" &&
        value !== null &&
        Object.getPrototypeOf(value) === Object.prototype
    );
}

/**
 * Parse JSON safely
 */
export function safeJsonParse<T = unknown>(
    json: string,
    fallback?: T
): T | undefined {
    try {
        return JSON.parse(json) as T;
    } catch {
        return fallback;
    }
}

/**
 * Stringify JSON safely
 */
export function safeJsonStringify(value: unknown, fallback: string = "{}"): string {
    try {
        return JSON.stringify(value);
    } catch {
        return fallback;
    }
}

/**
 * Check if a port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const net = require("net");
        const server = net.createServer();

        server.once("error", (err: NodeJS.ErrnoException) => {
            if (err.code === "EADDRINUSE") {
                resolve(false);
            } else {
                resolve(true);
            }
        });

        server.once("listening", () => {
            server.close();
            resolve(true);
        });

        server.listen(port, "127.0.0.1");
    });
}

/**
 * Format bytes to human readable size
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Calculate execution time
 */
export function calculateDuration(startTime: string, endTime: string): number {
    return new Date(endTime).getTime() - new Date(startTime).getTime();
}

/**
 * Check if a tool is safe (no confirmation required)
 */
export function isSafeTool(toolName: string): boolean {
    const safeTool = [
        "screenshot",
        "read_screen",
        "file_search",
        "file_read",
        "browser_open",
        "browser_search",
        "open_application",
        "bow_test",
        "get_health",
    ];
    return safeTool.includes(toolName);
}

/**
 * Normalize file path for cross-platform compatibility
 */
export function normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, "/");
}

/**
 * Extract query string parameters
 */
export function parseQueryString(query: string): Record<string, string> {
    const params: Record<string, string> = {};
    const parts = query.split("&");

    for (const part of parts) {
        const [key, value] = part.split("=");
        if (key) {
            params[decodeURIComponent(key)] = decodeURIComponent(value || "");
        }
    }

    return params;
}

/**
 * Generate a hash for a string (simple, not cryptographic)
 */
export function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
}

/**
 * Create a timeout promise
 */
export function createTimeoutPromise<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutError: Error = new Error("Operation timed out")
): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => {
            setTimeout(() => reject(timeoutError), timeoutMs);
        }),
    ]);
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
    fn: T,
    delayMs: number
): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout | null = null;

    return function debounced(...args: Parameters<T>) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            fn(...args);
            timeoutId = null;
        }, delayMs);
    };
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
    fn: T,
    delayMs: number
): (...args: Parameters<T>) => void {
    let lastCallTime = 0;
    let timeoutId: NodeJS.Timeout | null = null;

    return function throttled(...args: Parameters<T>) {
        const now = Date.now();

        if (now - lastCallTime >= delayMs) {
            fn(...args);
            lastCallTime = now;
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        } else if (!timeoutId) {
            timeoutId = setTimeout(() => {
                fn(...args);
                lastCallTime = Date.now();
                timeoutId = null;
            }, delayMs - (now - lastCallTime));
        }
    };
}
