/**
 * Tool Executor
 * Handles tool execution with proper error handling and remote agent communication
 */
import { Logger, ToolResult } from "@bow/shared";
import ToolRegistry from "./registry.js";
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
export declare class ToolExecutor {
    private logger;
    private registry;
    private server;
    private executionHistory;
    private maxHistorySize;
    constructor(logger: Logger, registry: ToolRegistry, server?: BOWServerType);
    execute(toolName: string, input: unknown, context: ExecutionContext): Promise<ExecutionResult>;
    private executeOnAgent;
    private addToHistory;
    getHistory(limit?: number): ExecutionResult[];
    getHistoryForSession(sessionId: string, limit?: number): ExecutionResult[];
    clearHistory(): void;
    getStats(): object;
}
export default ToolExecutor;
//# sourceMappingURL=executor.d.ts.map