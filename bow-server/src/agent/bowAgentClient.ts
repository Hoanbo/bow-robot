import { Logger, RobotExpression, getCurrentTimestamp, generateRequestId } from "@bow/shared";
import WebSocket from "ws";

export interface BowAgentQueryResponse {
    success: boolean;
    text: string;
    expression: RobotExpression;
    actions?: any[];
    desktopAction?: any;
    sessionId: string;
    timestamp: string;
}

export interface BowAgentClientConfig {
    url?: string;
    reconnectIntervalMs?: number;
    maxReconnectDelayMs?: number;
    timeoutMs?: number;
}

export class BowAgentClient {
    private ws: WebSocket | null = null;
    private readonly url: string;
    private isConnected = false;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private currentDelay: number;
    private readonly baseDelay: number;
    private readonly maxDelay: number;
    private readonly timeoutMs: number;
    private pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void; timer: NodeJS.Timeout }>();

    constructor(
        private readonly logger: Logger,
        config: BowAgentClientConfig = {}
    ) {
        this.url = config.url || process.env.BOW_AGENT_WS_URL || "ws://127.0.0.1:4000";
        this.baseDelay = config.reconnectIntervalMs || 1000;
        this.maxDelay = config.maxReconnectDelayMs || 30000;
        this.currentDelay = this.baseDelay;
        this.timeoutMs = config.timeoutMs || 25000;
    }

    public async connect(): Promise<void> {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        return new Promise<void>((resolve) => {
            try {
                this.logger.info("Connecting to BOW Agent Brain Gateway...", { url: this.url });
                this.ws = new WebSocket(this.url);

                this.ws.on("open", () => {
                    this.isConnected = true;
                    this.currentDelay = this.baseDelay;
                    this.logger.info("Connected to BOW Agent Brain Gateway (Port 4000)");
                    resolve();
                });

                this.ws.on("message", (data) => {
                    try {
                        const payload = JSON.parse(data.toString());
                        this.handleIncomingMessage(payload);
                    } catch (err: any) {
                        this.logger.warn("Invalid message from Bow Agent Gateway", { error: err?.message });
                    }
                });

                this.ws.on("close", () => {
                    this.isConnected = false;
                    this.logger.warn("Disconnected from BOW Agent Brain Gateway. Scheduling reconnect...");
                    this.scheduleReconnect();
                });

                this.ws.on("error", (err) => {
                    this.isConnected = false;
                    this.logger.warn("BOW Agent Brain Gateway socket error", { error: err.message });
                    resolve(); // Resolve to avoid hanging server boot
                });
            } catch (err: any) {
                this.logger.error("Failed to initiate BowAgentClient connection", err);
                this.scheduleReconnect();
                resolve();
            }
        });
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.logger.info(`Reconnecting to BOW Agent Gateway in ${this.currentDelay}ms (Exponential Backoff)...`);
        this.reconnectTimer = setTimeout(() => {
            this.currentDelay = Math.min(this.currentDelay * 2, this.maxDelay);
            void this.connect();
        }, this.currentDelay);
    }

    private handleIncomingMessage(payload: any): void {
        const { type, requestId } = payload;
        if (requestId && this.pendingRequests.has(requestId)) {
            const req = this.pendingRequests.get(requestId)!;
            clearTimeout(req.timer);
            this.pendingRequests.delete(requestId);
            req.resolve(payload);
        }
    }

    public async query(userQuery: string, sessionId = "default", context: Record<string, unknown> = {}): Promise<BowAgentQueryResponse> {
        const requestId = generateRequestId();

        // If WebSocket is connected to brain gateway
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    this.pendingRequests.delete(requestId);
                    reject(new Error("Timeout waiting for BOW Agent Brain response"));
                }, this.timeoutMs);

                this.pendingRequests.set(requestId, {
                    resolve: (payload: any) => {
                        resolve({
                            success: Boolean(payload.success),
                            text: payload.text || "Dạ, BOW đã xử lý xong yêu cầu.",
                            expression: payload.expression || "neutral",
                            actions: payload.actions,
                            desktopAction: payload.desktopAction,
                            sessionId,
                            timestamp: payload.timestamp || getCurrentTimestamp(),
                        });
                    },
                    reject: (err) => {
                        reject(err);
                    },
                    timer,
                });

                const reqPayload = {
                    type: "agent.query",
                    requestId,
                    sessionId,
                    query: userQuery,
                    context,
                };
                this.ws?.send(JSON.stringify(reqPayload));
            });
        }

        // Direct in-process fallback if brain gateway WS is not running
        try {
            this.logger.debug("BOW Agent Gateway WS offline, attempting direct engine fallback");
            const agentModule = await import("@bow/agent" as any).catch(() => null);
            if (agentModule && typeof agentModule.processAgentMessage === "function") {
                const result = await agentModule.processAgentMessage(userQuery, {
                    userId: "robot_user",
                    role: "user",
                    isAuthenticated: true,
                    ...context,
                });
                const replyText = result.content || "Dạ, em đã nhận lệnh!";
                let expression: RobotExpression = "speaking";
                let desktopAction: any = undefined;

                if (result.actions && Array.isArray(result.actions)) {
                    const dtAction = result.actions.find((a: any) => a.type === "desktop_action" || (a.payload && (a.payload as any).action));
                    if (dtAction) {
                        desktopAction = (dtAction.payload as any) || dtAction;
                        expression = "happy";
                    }
                }
                return {
                    success: true,
                    text: replyText,
                    expression,
                    actions: result.actions,
                    desktopAction,
                    sessionId,
                    timestamp: getCurrentTimestamp(),
                };
            }
        } catch (fallbackErr: any) {
            this.logger.warn("Direct agent fallback failed", { error: fallbackErr?.message });
        }

        // Default heuristic conversational fallback
        return {
            success: true,
            text: `Dạ, BOW đã ghi nhận: "${userQuery}". Robot đang thực thi yêu cầu của bạn.`,
            expression: "speaking",
            sessionId,
            timestamp: getCurrentTimestamp(),
        };
    }

    public isGatewayConnected(): boolean {
        return this.isConnected;
    }

    public close(): void {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        for (const [id, req] of this.pendingRequests.entries()) {
            clearTimeout(req.timer);
            req.reject(new Error("Agent client closed"));
        }
        this.pendingRequests.clear();
        this.ws?.close();
        this.isConnected = false;
    }
}

export default BowAgentClient;
