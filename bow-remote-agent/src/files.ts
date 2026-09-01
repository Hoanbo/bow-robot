/**
 * File Manager
 * Handles file operations (read, write, list, search)
 */

import { Logger, ToolResult, getCurrentTimestamp } from "@bow/shared";
import { promises as fs } from "fs";
import path from "path";

export interface FileInfo {
    name: string;
    path: string;
    size: number;
    isDirectory: boolean;
    created: string;
    modified: string;
}

export class FileManager {
    private logger: Logger;
    private allowedPaths: Set<string> = new Set();

    constructor(logger: Logger, allowedPaths?: string[]) {
        this.logger = logger;
        if (allowedPaths) {
            this.allowedPaths = new Set(allowedPaths);
        } else {
            // Default: user's documents directory
            this.allowedPaths.add(path.join(process.env.HOME || process.env.USERPROFILE || "~", "Documents"));
        }
    }

    async readFile(filePath: string): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            this.logger.debug("Reading file", { filePath });

            if (!this.isPathAllowed(filePath)) {
                throw new Error(`Access denied: ${filePath}`);
            }

            const content = await fs.readFile(filePath, "utf-8");

            return {
                success: true,
                action: "file_read",
                result: { path: filePath, size: content.length, lines: content.split("\n").length },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                action: "file_read",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async writeFile(filePath: string, content: string, append: boolean = false): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            this.logger.debug("Writing file", { filePath, append, size: content.length });

            if (!this.isPathAllowed(filePath)) {
                throw new Error(`Access denied: ${filePath}`);
            }

            // TODO: In production, this should require CONFIRM permission
            if (append) {
                await fs.appendFile(filePath, content);
            } else {
                await fs.writeFile(filePath, content, "utf-8");
            }

            return {
                success: true,
                action: "file_write",
                result: { path: filePath, size: content.length },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                action: "file_write",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async listDirectory(dirPath: string): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            this.logger.debug("Listing directory", { dirPath });

            if (!this.isPathAllowed(dirPath)) {
                throw new Error(`Access denied: ${dirPath}`);
            }

            const entries = await fs.readdir(dirPath, { withFileTypes: true });

            const files: FileInfo[] = [];
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                const stats = await fs.stat(fullPath);

                files.push({
                    name: entry.name,
                    path: fullPath,
                    size: stats.size,
                    isDirectory: entry.isDirectory(),
                    created: stats.birthtime.toISOString(),
                    modified: stats.mtime.toISOString(),
                });
            }

            return {
                success: true,
                action: "file_list",
                result: { path: dirPath, count: files.length, files },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                action: "file_list",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async searchFiles(pattern: string, searchPath?: string): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            const searchDir = searchPath || Array.from(this.allowedPaths)[0] || ".";

            this.logger.debug("Searching files", { pattern, searchPath: searchDir });

            if (!this.isPathAllowed(searchDir)) {
                throw new Error(`Access denied: ${searchDir}`);
            }

            // TODO: Implement recursive file search
            // 1. Walk directory tree
            // 2. Match pattern (filename or content)
            // 3. Return matching files

            const regex = new RegExp(pattern, "i");
            const results: string[] = [];

            // TODO: Recursively search
            const entries = await fs.readdir(searchDir, { withFileTypes: true });
            for (const entry of entries) {
                if (regex.test(entry.name)) {
                    results.push(path.join(searchDir, entry.name));
                }
            }

            return {
                success: true,
                action: "file_search",
                result: { pattern, matches: results.length, results },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                action: "file_search",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async deleteFile(filePath: string): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            this.logger.debug("Deleting file", { filePath });

            if (!this.isPathAllowed(filePath)) {
                throw new Error(`Access denied: ${filePath}`);
            }

            // TODO: In production, this should require CONFIRM permission
            await fs.unlink(filePath);

            return {
                success: true,
                action: "file_delete",
                result: { path: filePath },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                action: "file_delete",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async copyFile(sourcePath: string, destPath: string): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            this.logger.debug("Copying file", { sourcePath, destPath });

            if (!this.isPathAllowed(sourcePath) || !this.isPathAllowed(destPath)) {
                throw new Error("Access denied");
            }

            await fs.copyFile(sourcePath, destPath);

            return {
                success: true,
                action: "file_copy",
                result: { source: sourcePath, dest: destPath },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                action: "file_copy",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async moveFile(sourcePath: string, destPath: string): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            this.logger.debug("Moving file", { sourcePath, destPath });

            if (!this.isPathAllowed(sourcePath) || !this.isPathAllowed(destPath)) {
                throw new Error("Access denied");
            }

            await fs.rename(sourcePath, destPath);

            return {
                success: true,
                action: "file_move",
                result: { source: sourcePath, dest: destPath },
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                action: "file_move",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: getCurrentTimestamp(),
                duration: Date.now() - startTime,
                recoverable: true,
            };
        }
    }

    async getFileInfo(filePath: string): Promise<FileInfo | null> {
        try {
            if (!this.isPathAllowed(filePath)) {
                return null;
            }

            const stats = await fs.stat(filePath);

            return {
                name: path.basename(filePath),
                path: filePath,
                size: stats.size,
                isDirectory: stats.isDirectory(),
                created: stats.birthtime.toISOString(),
                modified: stats.mtime.toISOString(),
            };
        } catch {
            return null;
        }
    }

    private isPathAllowed(filePath: string): boolean {
        // TODO: Implement proper path security checking
        // For now, just check if in allowed paths
        if (this.allowedPaths.size === 0) {
            return true; // Allow all if no restrictions
        }

        const realPath = path.resolve(filePath);
        for (const allowed of this.allowedPaths) {
            if (realPath.startsWith(path.resolve(allowed))) {
                return true;
            }
        }

        return false;
    }

    addAllowedPath(dirPath: string): void {
        this.allowedPaths.add(dirPath);
        this.logger.debug("Allowed path added", { path: dirPath });
    }

    removeAllowedPath(dirPath: string): void {
        this.allowedPaths.delete(dirPath);
        this.logger.debug("Allowed path removed", { path: dirPath });
    }
}

export default FileManager;
