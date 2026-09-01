/**
 * Planner
 * Decomposes user goals into executable steps
 */
import { getCurrentTimestamp } from "@bow/shared";
export class Planner {
    constructor(logger, registry) {
        this.plans = new Map();
        this.logger = logger;
        this.registry = registry;
    }
    plan(goal) {
        const planId = this.generatePlanId();
        this.logger.debug("Planning goal", {
            goal,
            planId,
        });
        // TODO: Use AI/NLP to break down goal into steps
        // For now, implement basic pattern matching
        const steps = this.decomposeGoal(goal);
        const plan = {
            id: planId,
            goal,
            steps,
            estimatedDuration: this.estimateDuration(steps),
            createdAt: getCurrentTimestamp(),
            updatedAt: getCurrentTimestamp(),
        };
        this.plans.set(planId, plan);
        this.logger.info("Plan created", {
            planId,
            stepCount: steps.length,
            estimatedDuration: plan.estimatedDuration,
        });
        return plan;
    }
    decomposeGoal(goal) {
        const steps = [];
        const lowerGoal = goal.toLowerCase();
        // Pattern 1: "open [app] [with/at] [url]"
        const chromeMatch = lowerGoal.match(/open\s+(chrome|firefox|browser)(?:\s+(?:with|at|to)\s+(.+))?/i);
        if (chromeMatch) {
            steps.push({
                id: "step-1",
                toolName: "open_chrome",
                input: { url: chromeMatch[2] || "https://www.google.com" },
                description: `Open browser to ${chromeMatch[2] || "Google"}`,
                dependencies: [],
                retryCount: 0,
                maxRetries: 2,
                timeout: 30000,
            });
        }
        // Pattern 2: "search for [query]" (requires opening browser first)
        const searchMatch = lowerGoal.match(/search\s+(?:for\s+)?(.+)/i);
        if (searchMatch) {
            const query = searchMatch[1];
            steps.push({
                id: "step-1",
                toolName: "open_chrome",
                input: { url: "https://www.google.com" },
                description: "Open Google",
                dependencies: [],
                retryCount: 0,
                maxRetries: 2,
                timeout: 30000,
            });
            steps.push({
                id: "step-2",
                toolName: "keyboard_type",
                input: { text: query },
                description: `Type search query: ${query}`,
                dependencies: ["step-1"],
                retryCount: 0,
                maxRetries: 1,
                timeout: 5000,
            });
            steps.push({
                id: "step-3",
                toolName: "keyboard_press",
                input: { key: "Return" },
                description: "Press Enter to search",
                dependencies: ["step-2"],
                retryCount: 0,
                maxRetries: 1,
                timeout: 5000,
            });
        }
        // Pattern 3: "click on [element]" (requires screenshot first)
        const clickMatch = lowerGoal.match(/click\s+(?:on\s+)?(.+)/i);
        if (clickMatch && !searchMatch) {
            steps.push({
                id: "step-1",
                toolName: "screenshot",
                input: {},
                description: "Take screenshot to find element",
                dependencies: [],
                retryCount: 0,
                maxRetries: 1,
                timeout: 5000,
            });
        }
        // Pattern 4: "type [text]"
        const typeMatch = lowerGoal.match(/type\s+["'](.+)["']|type\s+(.+)/i);
        if (typeMatch) {
            const text = typeMatch[1] || typeMatch[2];
            steps.push({
                id: "step-1",
                toolName: "keyboard_type",
                input: { text },
                description: `Type: ${text}`,
                dependencies: [],
                retryCount: 0,
                maxRetries: 1,
                timeout: 5000,
            });
        }
        // Pattern 5: "go to [url]" or "visit [url]"
        const visitMatch = lowerGoal.match(/(?:go|visit)\s+(?:to\s+)?(.+)/i);
        if (visitMatch && !searchMatch && !chromeMatch) {
            steps.push({
                id: "step-1",
                toolName: "browser_navigate",
                input: { url: visitMatch[1] },
                description: `Navigate to ${visitMatch[1]}`,
                dependencies: [],
                retryCount: 0,
                maxRetries: 2,
                timeout: 30000,
            });
        }
        // Pattern 6: "read [file]" or "open [file]"
        const readMatch = lowerGoal.match(/(?:read|open|view)\s+(?:file\s+)?(.+)/i);
        if (readMatch && !chromeMatch && !visitMatch) {
            steps.push({
                id: "step-1",
                toolName: "file_read",
                input: { path: readMatch[1] },
                description: `Read file: ${readMatch[1]}`,
                dependencies: [],
                retryCount: 0,
                maxRetries: 1,
                timeout: 10000,
            });
        }
        // Pattern 7: "list files in [path]" or "show [directory]"
        const listMatch = lowerGoal.match(/(?:list|show|view)\s+(?:files\s+)?(?:in\s+)?(.+)/i);
        if (listMatch && !readMatch) {
            steps.push({
                id: "step-1",
                toolName: "file_list",
                input: { path: listMatch[1] },
                description: `List files in ${listMatch[1]}`,
                dependencies: [],
                retryCount: 0,
                maxRetries: 1,
                timeout: 10000,
            });
        }
        // Pattern 8: "run [command]" or "execute [command]"
        const runMatch = lowerGoal.match(/(?:run|execute)\s+(?:command\s+)?(.+)/i);
        if (runMatch) {
            steps.push({
                id: "step-1",
                toolName: "terminal_execute",
                input: { command: runMatch[1] },
                description: `Execute: ${runMatch[1]}`,
                dependencies: [],
                retryCount: 0,
                maxRetries: 1,
                timeout: 30000,
            });
        }
        // If no patterns matched, create a simple exploratory step
        if (steps.length === 0) {
            steps.push({
                id: "step-1",
                toolName: "screenshot",
                input: {},
                description: "Take screenshot to assess current state",
                dependencies: [],
                retryCount: 0,
                maxRetries: 1,
                timeout: 5000,
            });
        }
        return steps;
    }
    estimateDuration(steps) {
        // Rough estimate based on step count and timeouts
        let total = 0;
        for (const step of steps) {
            total += step.timeout || 5000;
        }
        return total;
    }
    getPlan(planId) {
        return this.plans.get(planId);
    }
    updatePlan(planId, updates) {
        const plan = this.plans.get(planId);
        if (!plan)
            return undefined;
        const updated = { ...plan, ...updates, updatedAt: getCurrentTimestamp() };
        this.plans.set(planId, updated);
        this.logger.debug("Plan updated", { planId });
        return updated;
    }
    deletePlan(planId) {
        return this.plans.delete(planId);
    }
    getPlans() {
        return Array.from(this.plans.values());
    }
    generatePlanId() {
        return `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    validatePlan(plan) {
        const errors = [];
        if (!plan.goal || typeof plan.goal !== "string") {
            errors.push("Plan must have a goal");
        }
        if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
            errors.push("Plan must have at least one step");
        }
        for (let i = 0; i < plan.steps.length; i++) {
            const step = plan.steps[i];
            if (!step.toolName) {
                errors.push(`Step ${i} must have a toolName`);
            }
            const tool = this.registry.getTool(step.toolName);
            if (!tool) {
                errors.push(`Step ${i} references unknown tool: ${step.toolName}`);
            }
            if (!step.id) {
                errors.push(`Step ${i} must have an id`);
            }
            for (const dep of step.dependencies) {
                const depStep = plan.steps.find((s) => s.id === dep);
                if (!depStep) {
                    errors.push(`Step ${i} depends on non-existent step: ${dep}`);
                }
            }
        }
        return { valid: errors.length === 0, errors };
    }
}
export default Planner;
//# sourceMappingURL=planner.js.map