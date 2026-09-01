/**
 * Remote Agent - authenticated WebSocket client.
 * The agent makes outbound connections only; it never exposes a desktop API.
 */

import {
    Logger,
    RemoteRequest,
    RemoteResponse,
    PROTOCOL_VERSION,
    REQUEST_TYPES,
    RESPONSE_TYPES,
    generateRequestId,
    generateSessionId,
    getCurrentTimestamp,
} from "@bow/shared";
import WebSocket from "ws";

export type ConnectionState =
    | "DISCONNECTED"
    | "CONNECTING"
    | "AUTHENTICATING"
    | "READY"
    | "ERROR"
    | "RECONNECTING";

export interface ConnectionConfig {
    host: string;
    port: number;
    token: string;
    reconnectAttempts?: number;
    reconnectDelayMs?: number;
    reconnectMaxDelayMs?: number;
    timeoutMs?: number;
    heartbeatIntervalMs?: number;
}

export interface PendingRequest {
    resolve: (value: RemoteResponse) => void;
    reject: (reason?: unknown) => void;
    timeout: NodeJS.Timeout;
}

export class RemoteAgentClient {
    private logger: Logger;
    private config: Required<ConnectionConfig>;
    private ws: WebSocket | null = null;
    private sessionId = generateSessionId();
    private pendingRequests = new Map<string, PendingRequest>();
    private authenticated = false;
    private reconnectCount = 0;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private heartbeatInFlight = false;
    private eventHandlers = new Map<string, Function[]>();
    private toolHandler?: (tool: string, args: Record<string, unknown>) => Promise<unknown>;
    private state: ConnectionState = "DISCONNECTED";
    private intentionalDisconnect = false;

    constructor(config: ConnectionConfig, logger: Logger) {
        this.config = {
            reconnectAttempts: 0,
            reconnectDelayMs: 1000,
            reconnectMaxDelayMs: 30000,
            timeoutMs: 30000,
            heartbeatIntervalMs: 5000,
            ...config,
        };
        this.logger = logger;
    }

    async connect(): Promise<void> {
        this.intentionalDisconnect = false;
        if (this.isConnected()) return;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        this.setState(this.reconnectCount > 0 ? "RECONNECTING" : "CONNECTING");
        const url = `ws://${this.config.host}:${this.config.port}/ws`;
        this.logger.info("AGENT_CONNECTING", { endpoint: `${this.config.host}:${this.config.port}` });

        await new Promise<void>((resolve, reject) => {
            const socket = new WebSocket(url);
            this.ws = socket;
            let settled = false;
            const fail = (error: unknown) => {
                if (!settled) {
                    settled = true;
                    reject(error instanceof Error ? error : new Error(String(error)));
                }
            };

            socket.on("open", async () => {
                try {
                    this.setState("AUTHENTICATING");
                    await this.authenticate();
                    this.reconnectCount = 0;
                    this.setState("READY");
                    this.setupHeartbeat();
                    this.logger.info("AGENT_READY", { sessionId: this.sessionId });
                    this.emit("connected");
                    if (!settled) {
                        settled = true;
                        resolve();
                    }
                } catch (error) {
                    this.setState("ERROR");
                    this.emit("auth_failed", error);
                    fail(error);
                    socket.close();
                }
            });
            socket.on("message", (data) => this.handleMessage(data));
            socket.on("close", () => {
                this.handleClose(socket);
                fail(new Error("WebSocket closed before authentication"));
            });
            socket.on("error", (error) => {
                this.handleError(error);
                fail(error);
            });
        });
    }

    private async authenticate(): Promise<void> {
        const request: RemoteRequest = {
            version: PROTOCOL_VERSION,
            requestId: generateRequestId(),
            sessionId: this.sessionId,
            type: REQUEST_TYPES.AUTH,
            token: this.config.token,
            timestamp: getCurrentTimestamp(),
        };
        const response = await this.sendRequest(request);
        if (!response.success) throw new Error(`Authentication failed: ${response.error}`);
        this.authenticated = true;
        this.logger.info("AGENT_AUTHENTICATED", { sessionId: this.sessionId });
    }

    private setupHeartbeat(): void {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = setInterval(() => {
            if (!this.isConnected() || this.heartbeatInFlight) return;
            this.heartbeatInFlight = true;
            const request: RemoteRequest = {
                version: PROTOCOL_VERSION,
                requestId: generateRequestId(),
                sessionId: this.sessionId,
                type: REQUEST_TYPES.HEARTBEAT,
                timestamp: getCurrentTimestamp(),
            };
            this.sendRequest(request)
                .then(() => undefined)
                .catch((error) => {
                    this.logger.warn("Heartbeat failed; closing stale connection", { error: String(error) });
                    this.ws?.terminate();
                })
                .finally(() => { this.heartbeatInFlight = false; });
        }, this.config.heartbeatIntervalMs);
    }

    async executeTool(tool: string, args: Record<string, unknown>): Promise<unknown> {
        if (!this.isConnected()) throw new Error("REMOTE_AGENT_NOT_READY");
        const request: RemoteRequest = {
            version: PROTOCOL_VERSION,
            requestId: generateRequestId(),
            sessionId: this.sessionId,
            type: REQUEST_TYPES.TOOL_EXECUTE,
            tool,
            arguments: args,
            timestamp: getCurrentTimestamp(),
        };
        const response = await this.sendRequest(request);
        if (!response.success) throw new Error(`Tool execution failed: ${response.error}`);
        return response.result;
    }

    private sendRequest(request: RemoteRequest): Promise<RemoteResponse> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error("Not connected"));
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(request.requestId);
                reject(new Error("Request timeout"));
            }, this.config.timeoutMs);
            this.pendingRequests.set(request.requestId, { resolve, reject, timeout });
            this.ws!.send(JSON.stringify(request));
        });
    }

    private handleMessage(data: WebSocket.Data): void {
        try {
            const message = JSON.parse(data.toString()) as RemoteResponse & { tool?: string; arguments?: Record<string, unknown> };
            if ((message.type as string) === REQUEST_TYPES.TOOL_EXECUTE && message.tool && this.toolHandler) {
                void this.handleToolRequest({ requestId: message.requestId, tool: message.tool, arguments: message.arguments });
                return;
            }
            if (message.requestId) {
                const pending = this.pendingRequests.get(message.requestId);
                if (pending) {
                    clearTimeout(pending.timeout);
                    this.pendingRequests.delete(message.requestId);
                    if (message.success) pending.resolve(message);
                    else pending.reject(new Error(message.error || "Unknown error"));
                    return;
                }
            }
            if (message.type === RESPONSE_TYPES.HEARTBEAT) return;
            this.logger.warn("Unknown message received", message as unknown as Record<string, unknown>);
        } catch (error) {
            this.logger.error("Error processing message", error instanceof Error ? error : new Error(String(error)));
        }
    }

    private async handleToolRequest(message: { requestId: string; tool: string; arguments?: Record<string, unknown> }): Promise<void> {
        try {
            const result = await this.toolHandler!(message.tool, message.arguments || {});
            this.ws?.send(JSON.stringify({ version: PROTOCOL_VERSION, requestId: message.requestId, type: RESPONSE_TYPES.TOOL_RESULT, success: true, result, timestamp: getCurrentTimestamp() }));
        } catch (error) {
            this.ws?.send(JSON.stringify({ version: PROTOCOL_VERSION, requestId: message.requestId, type: RESPONSE_TYPES.TOOL_RESULT, success: false, error: error instanceof Error ? error.message : String(error), timestamp: getCurrentTimestamp() }));
        }
    }

    setToolHandler(handler: (tool: string, args: Record<string, unknown>) => Promise<unknown>): void { this.toolHandler = handler; }

    private handleClose(socket: WebSocket): void {
        if (socket !== this.ws) return;
        this.authenticated = false;
        this.stopHeartbeat();
        for (const pending of this.pendingRequests.values()) {
            clearTimeout(pending.timeout);
            pending.reject(new Error("WebSocket disconnected"));
        }
        this.pendingRequests.clear();
        if (this.intentionalDisconnect) {
            this.setState("DISCONNECTED");
            this.emit("disconnected");
            return;
        }
        this.setState("DISCONNECTED");
        this.scheduleReconnect();
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer || this.intentionalDisconnect) return;
        // 0 means unlimited bounded retries, required for server/network restart recovery.
        if (this.config.reconnectAttempts > 0 && this.reconnectCount >= this.config.reconnectAttempts) {
            this.setState("ERROR");
            this.emit("reconnect_failed", new Error("Reconnect attempts exhausted"));
            return;
        }
        this.reconnectCount++;
        const delay = Math.min(this.config.reconnectMaxDelayMs, this.config.reconnectDelayMs * 2 ** Math.min(this.reconnectCount - 1, 10));
        this.setState("RECONNECTING");
        this.logger.info("AGENT_RECONNECTING", { attempt: this.reconnectCount, delayMs: delay });
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect().catch((error) => {
                this.logger.warn("Reconnect attempt failed", { error: String(error) });
                this.scheduleReconnect();
            });
        }, delay);
    }

    private stopHeartbeat(): void {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
        this.heartbeatInFlight = false;
    }

    private handleError(error: Error): void { this.logger.error("WebSocket error", error); this.emit("error", error); }
    isConnected(): boolean { return this.state === "READY" && this.ws?.readyState === WebSocket.OPEN && this.authenticated; }
    getState(): ConnectionState { return this.state; }
    getEndpoint(): string { return `${this.config.host}:${this.config.port}`; }

    disconnect(): void {
        this.intentionalDisconnect = true;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
        this.stopHeartbeat();
        this.authenticated = false;
        this.ws?.close();
        this.setState("DISCONNECTED");
    }

    on(event: string, handler: Function): void { if (!this.eventHandlers.has(event)) this.eventHandlers.set(event, []); this.eventHandlers.get(event)!.push(handler); }
    off(event: string, handler: Function): void { const handlers = this.eventHandlers.get(event); const index = handlers?.indexOf(handler) ?? -1; if (index >= 0) handlers!.splice(index, 1); }

    private setState(state: ConnectionState): void {
        if (this.state === state) return;
        this.state = state;
        this.emit("state", state);
    }

    private emit(event: string, ...args: unknown[]): void {
        for (const handler of this.eventHandlers.get(event) || []) {
            try { handler(...args); } catch (error) { this.logger.error(`Error in event handler for ${event}`, error instanceof Error ? error : new Error(String(error))); }
        }
    }
}

export default RemoteAgentClient;
