/**
 * Agent Executor
 * Executes plan steps sequentially with error recovery
 */

import { Logger, getCurrentTimestamp } from "@bow/shared";
import ToolExecutor, { ExecutionContext, ExecutionResult } from "../tools/executor.js";
import { Plan, PlanStep, Planner } from "./planner.js";

export interface StepResult {
    stepId: string;
    toolName: string;
    success: boolean;
    result: ExecutionResult | null;
    startTime: string;
    endTime: string;
    duration: number;
    retries: number;
    error?: string;
}

export interface ExecutionPlanResult {
    planId: string;
    goal: string;
    steps: StepResult[];
    success: boolean;
    totalDuration: number;
    completedAt: string;
}

export class AgentExecutor {
    private logger: Logger;
    private executor: ToolExecutor;
    private planner: Planner;
    private executions: Map<string, ExecutionPlanResult> = new Map();

    constructor(logger: Logger, executor: ToolExecutor, planner: Planner) {
        this.logger = logger;
        this.executor = executor;
        this.planner = planner;
    }

    async execute(plan: Plan, context: Partial<ExecutionContext> = {}): Promise<ExecutionPlanResult> {
        const startTime = Date.now();

        this.logger.info("Plan execution started", {
            planId: plan.id,
            goal: plan.goal,
            stepCount: plan.steps.length,
        });

        // Validate plan
        const validation = this.planner.validatePlan(plan);
        if (!validation.valid) {
            this.logger.error("Plan validation failed", new Error(validation.errors.join(", ")));
            throw new Error(`Invalid plan: ${validation.errors.join(", ")}`);
        }

        const stepResults: StepResult[] = [];
        const stepResultMap: Map<string, StepResult> = new Map();

        for (const step of plan.steps) {
            // Check if dependencies are satisfied
            const unsatisfiedDeps = step.dependencies.filter(
                (dep) => !stepResultMap.has(dep) || !stepResultMap.get(dep)!.success
            );

            if (unsatisfiedDeps.length > 0) {
                const error = `Unsatisfied dependencies: ${unsatisfiedDeps.join(", ")}`;
                this.logger.warn(`Step ${step.id} skipped`, { reason: error });

                const stepResult: StepResult = {
                    stepId: step.id,
                    toolName: step.toolName,
                    success: false,
                    result: null,
                    startTime: getCurrentTimestamp(),
                    endTime: getCurrentTimestamp(),
                    duration: 0,
                    retries: 0,
                    error,
                };

                stepResults.push(stepResult);
                stepResultMap.set(step.id, stepResult);
                continue;
            }

            // Execute step with retries
            const stepResult = await this.executeStep(step, context);
            stepResults.push(stepResult);
            stepResultMap.set(step.id, stepResult);

            // Stop execution if critical step fails
            if (!stepResult.success && step.maxRetries === 0) {
                this.logger.warn("Stopping execution due to failed critical step", {
                    stepId: step.id,
                    tool: step.toolName,
                });
                break;
            }
        }

        const result: ExecutionPlanResult = {
            planId: plan.id,
            goal: plan.goal,
            steps: stepResults,
            success: stepResults.every((s) => s.success),
            totalDuration: Date.now() - startTime,
            completedAt: getCurrentTimestamp(),
        };

        this.executions.set(plan.id, result);

        this.logger.info("Plan execution completed", {
            planId: plan.id,
            success: result.success,
            totalDuration: result.totalDuration,
            completedSteps: stepResults.filter((s) => s.success).length,
        });

        return result;
    }

    private async executeStep(step: PlanStep, context: Partial<ExecutionContext>): Promise<StepResult> {
        const stepStartTime = Date.now();

        let lastResult: ExecutionResult | null = null;
        let lastError: string | undefined;

        for (let attempt = 0; attempt <= step.maxRetries; attempt++) {
            try {
                this.logger.debug("Executing step", {
                    stepId: step.id,
                    tool: step.toolName,
                    attempt: attempt + 1,
                    maxRetries: step.maxRetries,
                });

                const fullContext: ExecutionContext = {
                    sessionId: context.sessionId || "default",
                    userId: context.userId || "system",
                    timestamp: getCurrentTimestamp(),
                    requestId: context.requestId || `exec-${step.id}-${attempt}`,
                };

                // Execute with timeout
                const result = await this.executeWithTimeout(
                    this.executor.execute(step.toolName, step.input, fullContext),
                    step.timeout
                );

                lastResult = result;

                if (result.success) {
                    return {
                        stepId: step.id,
                        toolName: step.toolName,
                        success: true,
                        result,
                        startTime: getCurrentTimestamp(),
                        endTime: getCurrentTimestamp(),
                        duration: Date.now() - stepStartTime,
                        retries: attempt,
                    };
                }

                lastError = result.error;

                // Log and retry
                this.logger.warn("Step execution failed, retrying", {
                    stepId: step.id,
                    attempt: attempt + 1,
                    error: result.error,
                });
            } catch (error) {
                lastError = error instanceof Error ? error.message : String(error);

                this.logger.warn("Step execution error", {
                    stepId: step.id,
                    attempt: attempt + 1,
                    error: lastError,
                });
            }

            // Wait before retry (exponential backoff)
            if (attempt < step.maxRetries) {
                const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, ...
                await this.sleep(delayMs);
            }
        }

        return {
            stepId: step.id,
            toolName: step.toolName,
            success: false,
            result: lastResult,
            startTime: getCurrentTimestamp(),
            endTime: getCurrentTimestamp(),
            duration: Date.now() - stepStartTime,
            retries: step.maxRetries,
            error: lastError || "Unknown error",
        };
    }

    private async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
        return Promise.race([
            promise,
            new Promise<T>((_, reject) =>
                setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
            ),
        ]);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    getExecution(planId: string): ExecutionPlanResult | undefined {
        return this.executions.get(planId);
    }

    getExecutions(): ExecutionPlanResult[] {
        return Array.from(this.executions.values());
    }

    getStats(): object {
        const executions = Array.from(this.executions.values());
        const successful = executions.filter((e) => e.success).length;

        return {
            totalExecutions: executions.length,
            successful,
            failed: executions.length - successful,
            successRate: executions.length > 0 ? (successful / executions.length) * 100 : 0,
            averageDuration:
                executions.length > 0
                    ? executions.reduce((sum, e) => sum + e.totalDuration, 0) / executions.length
                    : 0,
            timestamp: getCurrentTimestamp(),
        };
    }
}

export default AgentExecutor;
