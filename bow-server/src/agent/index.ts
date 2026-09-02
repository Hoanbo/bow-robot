/**
 * BOW Server - AI Agent Coordinator
 * Decoupled Brain Bridge: delegates natural language reasoning & intent routing
 * to BOW Agent V3.3 Brain Gateway (Port 4000), coordinating Desktop Actions with bow-remote-agent.
 */

import { Logger, getCurrentTimestamp, generateSessionId, RobotExpression } from "@bow/shared";
import ToolRegistry from "../tools/registry.js";
import ToolExecutor from "../tools/executor.js";
import BowAgentClient from "./bowAgentClient.js";

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

export class AIAgent {
    private logger: Logger;
    private registry: ToolRegistry;
    private toolExecutor: ToolExecutor;
    private brainClient: BowAgentClient;
    private conversations: Map<string, Conversation> = new Map();

    constructor(logger: Logger, registry: ToolRegistry, toolExecutor: ToolExecutor) {
        this.logger = logger;
        this.registry = registry;
        this.toolExecutor = toolExecutor;
        this.brainClient = new BowAgentClient(logger);
        void this.brainClient.connect();
    }

    async processInput(input: string, sessionId?: string): Promise<ConversationTurn> {
        const turnId = `turn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const session = sessionId || generateSessionId();
        const timestamp = getCurrentTimestamp();

        this.logger.info("Processing user input via BOW Agent Brain", {
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
            }

            // Route query to BOW Agent Brain Gateway (Port 4000)
            const brainResponse = await this.brainClient.query(input, session);

            // If brain responded with a desktop action, execute it via ToolExecutor / RemoteAgent
            if (brainResponse.desktopAction) {
                this.logger.info("Brain triggered Desktop Action", { action: brainResponse.desktopAction });
                try {
                    await this.executeDesktopAction(brainResponse.desktopAction, session);
                } catch (actionErr: any) {
                    this.logger.warn("Desktop action execution error", { error: actionErr?.message });
                }
            }

            const turn: ConversationTurn = {
                id: turnId,
                input,
                response: brainResponse.text,
                expression: brainResponse.expression,
                actions: brainResponse.actions,
                desktopAction: brainResponse.desktopAction,
                timestamp,
                success: brainResponse.success,
            };

            conversation.turns.push(turn);
            conversation.lastActivity = timestamp;

            this.logger.info("User input processed successfully by BOW Agent", {
                turnId,
                expression: turn.expression,
            });

            return turn;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);

            this.logger.error("Error processing input", error instanceof Error ? error : new Error(String(error)), {
                turnId,
                sessionId: session,
            });

            return {
                id: turnId,
                input,
                response: `Thưa Ngài, hệ thống gặp sự cố: ${errorMsg}. Tôi kính mong Ngài lượng thứ và thử lại.`,
                expression: "error",
                timestamp,
                success: false,
            };
        }
    }

    private async executeDesktopAction(actionData: any, sessionId: string): Promise<void> {
        const action = actionData.action || actionData.name;
        const target = actionData.target || actionData.url || actionData.command || actionData.name;
        const context = {
            sessionId,
            userId: sessionId,
            timestamp: getCurrentTimestamp(),
            requestId: generateSessionId(),
        };

        if (action === "open_app" || action === "open_application") {
            await this.toolExecutor.execute("open_application", { name: target }, context);
        } else if (action === "open_chrome" || action === "open_browser") {
            await this.toolExecutor.execute("open_chrome", { url: actionData.url }, context);
        } else if (action === "browser_search") {
            await this.toolExecutor.execute("browser_search", { query: actionData.query || target }, context);
        } else if (action === "screenshot") {
            await this.toolExecutor.execute("screenshot", {}, context);
        } else if (action === "terminal_execute" || action === "terminal_cmd") {
            await this.toolExecutor.execute("terminal_execute", { command: actionData.command || target }, context);
        }
    }

    getConversation(sessionId: string): Conversation | undefined {
        return this.conversations.get(sessionId);
    }

    getConversations(): Conversation[] {
        return Array.from(this.conversations.values());
    }

    deleteConversation(sessionId: string): boolean {
        return this.conversations.delete(sessionId);
    }

    getLastTurn(sessionId: string): ConversationTurn | undefined {
        const conversation = this.conversations.get(sessionId);
        if (!conversation || conversation.turns.length === 0) {
            return undefined;
        }
        return conversation.turns[conversation.turns.length - 1];
    }

    getStats(): object {
        const conversations = Array.from(this.conversations.values());
        const totalTurns = conversations.reduce((sum, c) => sum + c.turns.length, 0);
        const successfulTurns = conversations.reduce(
            (sum, c) => sum + c.turns.filter((t) => t.success !== false).length,
            0
        );

        return {
            brainGatewayConnected: this.brainClient.isGatewayConnected(),
            conversationCount: conversations.length,
            totalTurns,
            successfulTurns,
            successRate: totalTurns > 0 ? (successfulTurns / totalTurns) * 100 : 0,
            toolCount: this.registry.getAll().length,
            categoryCount: this.registry.getCategories().length,
            timestamp: getCurrentTimestamp(),
        };
    }

    getToolInfo(): object {
        return this.registry.getInfo();
    }

    getPlannerStats(): object {
        return {
            mode: "decoupled_bow_agent_v3.3",
            brainGatewayConnected: this.brainClient.isGatewayConnected(),
            timestamp: getCurrentTimestamp(),
        };
    }

    getExecutorStats(): object {
        return {
            totalExecuted: 0,
            timestamp: getCurrentTimestamp(),
        };
    }
}

export default AIAgent;
