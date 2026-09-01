/**
 * AI Agent
 * Main coordinator for natural language processing and execution
 */
import { Logger } from "@bow/shared";
import ToolRegistry from "../tools/registry.js";
import ToolExecutor from "../tools/executor.js";
import { Plan } from "./planner.js";
import { ExecutionPlanResult } from "./executor.js";
export interface ConversationTurn {
    id: string;
    input: string;
    plan?: Plan;
    execution?: ExecutionPlanResult;
    response: string;
    timestamp: string;
}
export interface Conversation {
    id: string;
    sessionId: string;
    turns: ConversationTurn[];
    startedAt: string;
    lastActivity: string;
}
export declare class AIAgent {
    private logger;
    private registry;
    private toolExecutor;
    private planner;
    private executor;
    private conversations;
    private sessionTimeout;
    constructor(logger: Logger, registry: ToolRegistry, toolExecutor: ToolExecutor);
    processInput(input: string, sessionId?: string): Promise<ConversationTurn>;
    private parseIntent;
    private generateResponse;
    getConversation(sessionId: string): Conversation | undefined;
    getConversations(): Conversation[];
    deleteConversation(sessionId: string): boolean;
    getLastTurn(sessionId: string): ConversationTurn | undefined;
    getStats(): object;
    getToolInfo(): object;
    getPlannerStats(): object;
    getExecutorStats(): object;
}
export default AIAgent;
//# sourceMappingURL=index.d.ts.map