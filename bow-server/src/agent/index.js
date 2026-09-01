/**
 * AI Agent
 * Main coordinator for natural language processing and execution
 */
import { getCurrentTimestamp, generateSessionId } from "@bow/shared";
import Planner from "./planner.js";
import AgentExecutor from "./executor.js";
export class AIAgent {
    constructor(logger, registry, toolExecutor) {
        this.conversations = new Map();
        this.sessionTimeout = 3600000; // 1 hour
        this.logger = logger;
        this.registry = registry;
        this.toolExecutor = toolExecutor;
        this.planner = new Planner(logger, registry);
        this.executor = new AgentExecutor(logger, toolExecutor, this.planner);
    }
    async processInput(input, sessionId) {
        const turnId = `turn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const session = sessionId || generateSessionId();
        const timestamp = getCurrentTimestamp();
        this.logger.info("Processing user input", {
            turnId,
            sessionId: session,
            inputLength: input.length,
        });
        try {
            // Get or create conversation
            let conversation = this.conversations.get(session);
            if (!conversation) {
                conversation = {
                    id: generateSessionId(),
                    sessionId: session,
                    turns: [],
                    startedAt: timestamp,
                    lastActivity: timestamp,
                };
                this.conversations.set(session, conversation);
                this.logger.debug("New conversation created", { sessionId: session });
            }
            // Step 1: Understand intent (parse input)
            this.logger.debug("Parsing input");
            const intent = this.parseIntent(input);
            // Step 2: Create plan
            this.logger.debug("Creating plan", { intent });
            const plan = this.planner.plan(intent);
            // Step 3: Execute plan
            this.logger.debug("Executing plan", { planId: plan.id });
            const execution = await this.executor.execute(plan, {
                sessionId: session,
                userId: session,
            });
            // Step 4: Generate response
            const response = this.generateResponse(input, plan, execution);
            // Store turn in conversation
            const turn = {
                id: turnId,
                input,
                plan,
                execution,
                response,
                timestamp,
            };
            conversation.turns.push(turn);
            conversation.lastActivity = timestamp;
            this.logger.info("User input processed successfully", {
                turnId,
                success: execution.success,
                steps: execution.steps.length,
            });
            return turn;
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.error("Error processing input", error instanceof Error ? error : new Error(String(error)), {
                turnId,
                sessionId: session,
            });
            return {
                id: turnId,
                input,
                response: `Error processing request: ${errorMsg}. Please try again with a different request.`,
                timestamp,
            };
        }
    }
    parseIntent(input) {
        // Simple intent parsing - just return the input as the intent for now
        // TODO: Use NLP library like compromise.js or similar
        return input.trim();
    }
    generateResponse(input, plan, execution) {
        if (!execution.success) {
            const failedSteps = execution.steps.filter((s) => !s.success);
            return `I attempted to execute your request but encountered issues: ${failedSteps.map((s) => s.error).join("; ")}. The plan had ${execution.steps.length} steps, ${execution.steps.filter((s) => s.success).length} succeeded.`;
        }
        // Generate context-aware response
        const successfulSteps = execution.steps.filter((s) => s.success).length;
        if (input.toLowerCase().includes("open chrome") || input.toLowerCase().includes("open browser")) {
            return "✓ Chrome browser opened successfully.";
        }
        if (input.toLowerCase().includes("search")) {
            return "✓ Search request completed. Chrome should now display search results.";
        }
        if (input.toLowerCase().includes("click")) {
            return "✓ Click action completed.";
        }
        if (input.toLowerCase().includes("type")) {
            return "✓ Text entered successfully.";
        }
        return `✓ Task completed successfully. Executed ${successfulSteps} step(s) in ${execution.totalDuration}ms.`;
    }
    getConversation(sessionId) {
        return this.conversations.get(sessionId);
    }
    getConversations() {
        return Array.from(this.conversations.values());
    }
    deleteConversation(sessionId) {
        return this.conversations.delete(sessionId);
    }
    getLastTurn(sessionId) {
        const conversation = this.conversations.get(sessionId);
        if (!conversation || conversation.turns.length === 0) {
            return undefined;
        }
        return conversation.turns[conversation.turns.length - 1];
    }
    getStats() {
        const conversations = Array.from(this.conversations.values());
        const totalTurns = conversations.reduce((sum, c) => sum + c.turns.length, 0);
        const successfulTurns = conversations.reduce((sum, c) => sum + c.turns.filter((t) => t.execution?.success).length, 0);
        return {
            conversationCount: conversations.length,
            totalTurns,
            successfulTurns,
            successRate: totalTurns > 0 ? (successfulTurns / totalTurns) * 100 : 0,
            toolCount: this.registry.getAll().length,
            categoryCount: this.registry.getCategories().length,
            timestamp: getCurrentTimestamp(),
        };
    }
    getToolInfo() {
        return this.registry.getInfo();
    }
    getPlannerStats() {
        return {
            totalPlans: this.planner.getPlans().length,
            timestamp: getCurrentTimestamp(),
        };
    }
    getExecutorStats() {
        return this.executor.getStats();
    }
}
export default AIAgent;
//# sourceMappingURL=index.js.map