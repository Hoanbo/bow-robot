/**
 * Tool Executor
 * Handles tool execution with proper error handling and remote agent communication
 */
import { getCurrentTimestamp } from "@bow/shared";
export class ToolExecutor {
    constructor(logger, registry, server) {
        this.executionHistory = [];
        this.maxHistorySize = 1000;
        this.logger = logger;
        this.registry = registry;
        this.server = server;
    }
    async execute(toolName, input, context) {
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
            // Step 4: Send to remote agent and get result
            const result = await this.executeOnAgent(tool, input, context);
            // Step 5: Store in history
            const execution = {
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
        }
        catch (error) {
            const execution = {
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
    async executeOnAgent(tool, input, context) {
        // TODO: Send to remote agent and wait for result
        // For now, return mock result
        return {
            success: true,
            action: tool.name,
            result: {},
            timestamp: getCurrentTimestamp(),
            duration: 0,
        };
    }
    addToHistory(execution) {
        this.executionHistory.push(execution);
        // Keep history size bounded
        if (this.executionHistory.length > this.maxHistorySize) {
            this.executionHistory = this.executionHistory.slice(-this.maxHistorySize);
        }
    }
    getHistory(limit = 100) {
        return this.executionHistory.slice(-limit);
    }
    getHistoryForSession(sessionId, limit = 50) {
        return this.executionHistory
            .filter((e) => e.context.sessionId === sessionId)
            .slice(-limit);
    }
    clearHistory() {
        this.executionHistory = [];
        this.logger.debug("Execution history cleared");
    }
    getStats() {
        const successful = this.executionHistory.filter((e) => e.success).length;
        const failed = this.executionHistory.filter((e) => !e.success).length;
        const avgDuration = this.executionHistory.length > 0
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
//# sourceMappingURL=executor.js.map