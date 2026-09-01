/**
 * Planner
 * Decomposes user goals into executable steps
 */
import { Logger } from "@bow/shared";
import ToolRegistry from "../tools/registry.js";
export interface PlanStep {
    id: string;
    toolName: string;
    input: Record<string, unknown>;
    description: string;
    dependencies: string[];
    retryCount: number;
    maxRetries: number;
    timeout: number;
}
export interface Plan {
    id: string;
    goal: string;
    steps: PlanStep[];
    estimatedDuration: number;
    createdAt: string;
    updatedAt: string;
}
export declare class Planner {
    private logger;
    private registry;
    private plans;
    constructor(logger: Logger, registry: ToolRegistry);
    plan(goal: string): Plan;
    private decomposeGoal;
    private estimateDuration;
    getPlan(planId: string): Plan | undefined;
    updatePlan(planId: string, updates: Partial<Plan>): Plan | undefined;
    deletePlan(planId: string): boolean;
    getPlans(): Plan[];
    private generatePlanId;
    validatePlan(plan: Plan): {
        valid: boolean;
        errors: string[];
    };
}
export default Planner;
//# sourceMappingURL=planner.d.ts.map