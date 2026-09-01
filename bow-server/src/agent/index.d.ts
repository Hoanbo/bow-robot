/**
 * BOW Server - AI Agent Coordinator
 * Decoupled Brain Bridge: delegates natural language reasoning & intent routing
 * to BOW Agent V3.3 Brain Gateway (Port 4000), coordinating Desktop Actions with bow-remote-agent.
 */
import { Logger, RobotExpression } from "@bow/shared";
import ToolRegistry from "../tools/registry.js";
import ToolExecutor from "../tools/executor.js";
export interface ConversationTurn {
    id: string;
    input: string;
    response: string;
    expression?: RobotExpression;
    actions?: any[];
    desktopAction?: any;
    timestamp: string;
    success?: boolean;
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
    private brainClient;
    private conversations;
    constructor(logger: Logger, registry: ToolRegistry, toolExecutor: ToolExecutor);
    processInput(input: string, sessionId?: string): Promise<ConversationTurn>;
    private executeDesktopAction;
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