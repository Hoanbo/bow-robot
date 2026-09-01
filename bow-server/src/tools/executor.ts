/**
 * Tool Executor
 * Handles tool execution with proper error handling and remote agent communication
 */

import { Logger, ToolResult, getCurrentTimestamp } from "@bow/shared";
import ToolRegistry, { RegisteredTool } from "./registry.js";
import { SafetyPolicy } from "../safety.js";

// Forward declaration to avoid circular dependency
export type BOWServerType = any;

export interface ExecutionContext {
    sessionId: string;
    userId: string;
    timestamp: string;
    requestId: string;
}

export interface ExecutionResult {
    success: boolean;
    tool: string;
    input: unknown;
    output: ToolResult | null;
    error?: string;
    context: ExecutionContext;
    duration: number;
}

export class ToolExecutor {
    private logger: Logger;
    private registry: ToolRegistry;
    private server: BOWServerType;
    private safety: SafetyPolicy;
    private executionHistory: ExecutionResult[] = [];
    private maxHistorySize: number = 1000;

    constructor(logger: Logger, registry: ToolRegistry, server?: BOWServerType, safety?: SafetyPolicy) {
        this.logger = logger;
        this.registry = registry;
        this.server = server;
        this.safety = safety || new SafetyPolicy();
    }

    async execute(
        toolName: string,
        input: unknown,
        context: ExecutionContext
    ): Promise<ExecutionResult> {
        const startTime = Date.now();

        try {
            this.logger.debug("Tool execution started", {
                tool: toolName,
                sessionId: context.sessionId,
            });

            // Step 1: Validate tool exists
            const tool = this.registry.getTool(toolName);
            if (!tool) {
                throw new Error(`Unknown tool: ${toolName}`);
            }

            // Step 2: Validate input against schema
            const validation = this.registry.validateInput(toolName, input);
            if (!validation.valid) {
                throw new Error(`Invalid input: ${validation.errors.join(", ")}`);
            }

            // Step 3: Check permissions
            if (tool.permission === "BLOCKED") {
                throw new Error(`Tool is blocked: ${toolName}`);
            }

            const confirmed = typeof input === "object" && input !== null && (input as Record<string, unknown>).__confirmed === true;
            const safety = this.safety.assess(tool.name, tool.permission, confirmed);
            if (!safety.allowed) throw new Error(safety.requiresConfirmation ? `Confirmation required for ${toolName}` : safety.reason || "Safety policy denied tool");

            // Server-local adapters (for example BOW TEST) do not cross the LAN.
            const result = tool.category === "test" && tool.handler
                ? await tool.handler(input as Record<string, unknown>)
                : await this.executeOnAgent(tool, input, context);

            // Step 5: Store in history
            const execution: ExecutionResult = {
                success: result.success,
                tool: toolName,
                input,
                output: result,
                context,
                duration: Date.now() - startTime,
            };

            this.addToHistory(execution);

            this.logger.info("Tool execution completed", {
                tool: toolName,
                success: result.success,
                duration: execution.duration,
            });

            return execution;
        } catch (error) {
            const execution: ExecutionResult = {
                success: false,
                tool: toolName,
                input,
                output: null,
                error: error instanceof Error ? error.message : String(error),
                context,
                duration: Date.now() - startTime,
            };

            this.addToHistory(execution);

            this.logger.error("Tool execution failed", error instanceof Error ? error : new Error(String(error)), {
                tool: toolName,
                duration: execution.duration,
            });

            return execution;
        }
    }

    private async executeOnAgent(
        tool: RegisteredTool,
        input: unknown,
        context: ExecutionContext
    ): Promise<ToolResult> {
        if (!this.server || typeof this.server.executeOnRemoteAgent !== "function") {
            throw new Error("Remote agent gateway is not configured");
        }
        return this.server.executeOnRemoteAgent(tool.name, input as Record<string, unknown>, context.sessionId, context.requestId);
    }

    private addToHistory(execution: ExecutionResult): void {
        this.executionHistory.push(execution);

        // Keep history size bounded
        if (this.executionHistory.length > this.maxHistorySize) {
            this.executionHistory = this.executionHistory.slice(-this.maxHistorySize);
        }
    }

    getHistory(limit: number = 100): ExecutionResult[] {
        return this.executionHistory.slice(-limit);
    }

    getHistoryForSession(sessionId: string, limit: number = 50): ExecutionResult[] {
        return this.executionHistory
            .filter((e) => e.context.sessionId === sessionId)
            .slice(-limit);
    }

    clearHistory(): void {
        this.executionHistory = [];
        this.logger.debug("Execution history cleared");
    }

    getStats(): object {
        const successful = this.executionHistory.filter((e) => e.success).length;
        const failed = this.executionHistory.filter((e) => !e.success).length;
        const avgDuration =
            this.executionHistory.length > 0
                ? this.executionHistory.reduce((sum, e) => sum + e.duration, 0) / this.executionHistory.length
                : 0;

        return {
            totalExecutions: this.executionHistory.length,
            successful,
            failed,
            successRate: this.executionHistory.length > 0 ? (successful / this.executionHistory.length) * 100 : 0,
            averageDuration: Math.round(avgDuration),
            timestamp: getCurrentTimestamp(),
        };
    }
}

export default ToolExecutor;
