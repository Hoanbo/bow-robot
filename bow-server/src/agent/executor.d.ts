/**
 * Agent Executor
 * Executes plan steps sequentially with error recovery
 */
import { Logger } from "@bow/shared";
import ToolExecutor, { ExecutionContext, ExecutionResult } from "../tools/executor.js";
import { Plan, Planner } from "./planner.js";
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
export declare class AgentExecutor {
    private logger;
    private executor;
    private planner;
    private executions;
    constructor(logger: Logger, executor: ToolExecutor, planner: Planner);
    execute(plan: Plan, context?: Partial<ExecutionContext>): Promise<ExecutionPlanResult>;
    private executeStep;
    private executeWithTimeout;
    private sleep;
    getExecution(planId: string): ExecutionPlanResult | undefined;
    getExecutions(): ExecutionPlanResult[];
    getStats(): object;
}
export default AgentExecutor;
//# sourceMappingURL=executor.d.ts.map