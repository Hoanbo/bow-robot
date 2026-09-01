/**
 * BOW Server - Main Server Class
 * Manages WebSocket connections, authentication, and request routing
 */

import {
    Logger,
    RemoteRequest,
    RemoteResponse,
    Session,
    SessionInfo,
    PROTOCOL_VERSION,
    generateSessionId,
    generateRequestId,
    getCurrentTimestamp,
    RESPONSE_TYPES,
    REQUEST_TYPES,
    ERROR_CODES,
} from "@bow/shared";
import WebSocket, { WebSocketServer } from "ws";
import { ServerConfig } from "./config.js";
import ToolRegistry from "./tools/registry.js";
import ToolExecutor from "./tools/executor.js";
import AIAgent from "./agent/index.js";
import http from "http";
import { OpenAISpeechProvider } from "./speech.js";
import { MetadataVisionProvider } from "./vision.js";
import { JsonMemoryProvider } from "./memory.js";
import { SafetyPolicy } from "./safety.js";
import BowTestRunner from "./bow-test.js";
import crypto from "crypto";

export interface ClientConnection {
    id: string;
    ws: WebSocket;
    session: Session;
    authenticated: boolean;
    lastActivity: string;
    requestCount: number;
}

export class BOWServer {
    private logger: Logger;
    private config: ServerConfig;
    private httpServer?: http.Server;
    private wsServer?: WebSocketServer;
    private clients: Map<string, ClientConnection> = new Map();
    private sessions: Map<string, Session> = new Map();
    private startTime: number = 0;
    private registry: ToolRegistry;
    private toolExecutor: ToolExecutor;
    private agent: AIAgent;
    private speech: OpenAISpeechProvider;
    private vision: MetadataVisionProvider;
    private memory: JsonMemoryProvider;
    private safety = new SafetyPolicy();

    constructor(config: ServerConfig, logger: Logger) {
        this.config = config;
        this.logger = logger;
        this.registry = new ToolRegistry(logger);
        this.toolExecutor = new ToolExecutor(logger, this.registry, this, this.safety);
        this.agent = new AIAgent(logger, this.registry, this.toolExecutor);
        this.speech = new OpenAISpeechProvider(logger, {
            sttApiKey: config.sttApiKey,
            ttsApiKey: config.ttsApiKey,
            sttModel: config.sttModel,
            ttsModel: config.ttsModel,
            ttsVoice: config.ttsVoice,
        });
        this.vision = new MetadataVisionProvider(logger);
        this.memory = new JsonMemoryProvider(logger, config.memoryDbPath.endsWith(".json") ? config.memoryDbPath : `${config.memoryDbPath}.json`, config.memoryMaxSize);
        const bowTest = new BowTestRunner(logger);
        this.registry.register({ name: "bow_test", category: "test", permission: "SAFE", description: "Run the configured BOW TEST command", handler: async (args) => bowTest.run(args as any), schema: { type: "object", properties: { command: { type: "string" }, cwd: { type: "string" }, timeoutMs: { type: "number" } } } });
    }

    async start(): Promise<void> {
        this.startTime = Date.now();

        try {
            this.logger.info("Starting BOW Server", {
                version: this.config.version,
                host: this.config.host,
                port: this.config.port,
            });

            // Create HTTP server
            this.httpServer = http.createServer(this.handleHttpRequest.bind(this));

            // Create WebSocket server
            this.wsServer = new WebSocketServer({ server: this.httpServer });

            // Setup WebSocket handlers
            this.wsServer.on("connection", this.handleWebSocketConnection.bind(this));

            // Start listening
            await this.listen();

            this.logger.info("BOW Server started successfully", {
                wsEndpoint: `ws://${this.config.host}:${this.config.port}/ws`,
                maxConnections: this.config.maxConnections,
            });
        } catch (error) {
            this.logger.error(
                "Failed to start BOW Server",
                error instanceof Error ? error : new Error(String(error))
            );
            throw error;
        }
    }

    private async listen(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.httpServer!.listen(this.config.port, this.config.host, () => {
                resolve();
            });

            this.httpServer!.on("error", (error) => {
                reject(error);
            });
        });
    }

    private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
        // Basic HTTP routing
        if (req.url === "/health" && req.method === "GET") {
            this.handleHealthCheck(req, res);
        } else if (req.url === "/tools" && req.method === "GET") {
            this.handleToolsList(req, res);
        } else if (req.url?.startsWith("/sessions/") && req.method === "GET") {
            this.handleSessionInfo(req, res);
        } else if (req.url === "/agent/query" && req.method === "POST") {
            this.handleAgentQuery(req, res);
        } else if (req.url === "/speech/transcribe" && req.method === "POST") {
            this.handleTranscription(req, res);
        } else if (req.url === "/speech/synthesize" && req.method === "POST") {
            this.handleSynthesis(req, res);
        } else if (req.url === "/vision/analyze" && req.method === "POST") {
            this.handleVisionAnalyze(req, res);
        } else if (req.url === "/memory" && req.method === "GET") {
            this.handleMemoryList(req, res);
        } else if (req.url === "/agent/stats" && req.method === "GET") {
            this.handleAgentStats(req, res);
        } else if (req.url?.startsWith("/agent/conversations/") && req.method === "GET") {
            this.handleAgentConversation(req, res);
        } else {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Not found" }));
        }
    }

    private handleHealthCheck(req: http.IncomingMessage, res: http.ServerResponse): void {
        const uptime = Date.now() - this.startTime;
        const remoteAgent = this.getRemoteAgentStatus();
        const response = {
            status: remoteAgent === "connected" ? "ok" : "degraded",
            version: this.config.version,
            uptime,
            services: {
                agent: "ready",
                memory: "ready",
                tools: "ready",
                remoteAgent,
            },
            timestamp: getCurrentTimestamp(),
        };

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));

        this.logger.debug("Health check requested");
    }

    private handleToolsList(req: http.IncomingMessage, res: http.ServerResponse): void {
        const response = this.registry.getInfo();

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));

        this.logger.debug("Tools list requested");
    }

    private handleSessionInfo(req: http.IncomingMessage, res: http.ServerResponse): void {
        const sessionId = req.url?.split("/").pop() || "";
        const session = this.sessions.get(sessionId);

        if (!session) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Session not found" }));
            return;
        }

        const response: SessionInfo = {
            sessionId: session.id,
            startTime: session.createdAt,
            requestCount: 0, // TODO: Track request count
            lastActivity: session.updatedAt,
            remoteAgentConnected: this.isRemoteAgentConnected(sessionId),
        };

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));

        this.logger.debug("Session info requested", { sessionId });
    }

    private handleWebSocketConnection(ws: WebSocket, req: http.IncomingMessage): void {
        const clientId = generateSessionId();

        try {
            // Check connection limit
            if (this.clients.size >= this.config.maxConnections) {
                ws.close(1008, "Server full");
                this.logger.warn("Connection rejected: server full", { clientId });
                return;
            }

            this.logger.debug("WebSocket connection established", { clientId });

            // Create client connection
            const connection: ClientConnection = {
                id: clientId,
                ws,
                session: {
                    id: generateSessionId(),
                    createdAt: getCurrentTimestamp(),
                    updatedAt: getCurrentTimestamp(),
                    expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
                    metadata: {},
                },
                authenticated: false,
                lastActivity: getCurrentTimestamp(),
                requestCount: 0,
            };

            this.clients.set(clientId, connection);
            this.sessions.set(connection.session.id, connection.session);

            // Setup WebSocket message handler
            ws.on("message", (data) => this.handleMessage(clientId, data));

            // Setup WebSocket close handler
            ws.on("close", () => this.handleClose(clientId));

            // Setup WebSocket error handler
            ws.on("error", (error) => this.handleError(clientId, error));

            // Setup keep-alive/heartbeat
            this.setupHeartbeat(clientId);

            this.logger.info("Client connected", {
                clientId,
                totalConnections: this.clients.size,
            });
        } catch (error) {
            this.logger.error(
                "Error handling WebSocket connection",
                error instanceof Error ? error : new Error(String(error))
            );
            ws.close(1011, "Internal server error");
        }
    }

    private handleMessage(clientId: string, data: WebSocket.Data): void {
        const connection = this.clients.get(clientId);
        if (!connection) {
            this.logger.warn("Message from unknown client", { clientId });
            return;
        }

        try {
            connection.lastActivity = getCurrentTimestamp();

            // Parse message
            let request: RemoteRequest;
            try {
                request = JSON.parse(data.toString());
            } catch {
                this.sendResponse(clientId, {
                    version: PROTOCOL_VERSION,
                    requestId: generateRequestId(),
                    type: RESPONSE_TYPES.ERROR,
                    success: false,
                    error: "Invalid JSON",
                    timestamp: getCurrentTimestamp(),
                });
                return;
            }

            // Tool results are responses to a server-initiated request. The
            // request-specific listener resolves them; do not route them as
            // new client requests.
            if ((request as any).type === RESPONSE_TYPES.TOOL_RESULT) return;

            // Validate protocol version
            if (request.version !== PROTOCOL_VERSION) {
                this.sendResponse(clientId, {
                    version: PROTOCOL_VERSION,
                    requestId: request.requestId,
                    type: RESPONSE_TYPES.ERROR,
                    success: false,
                    error: `Protocol version mismatch: expected ${PROTOCOL_VERSION}, got ${request.version}`,
                    timestamp: getCurrentTimestamp(),
                });
                return;
            }

            // Route based on type
            switch (request.type) {
                case REQUEST_TYPES.AUTH:
                    this.handleAuth(clientId, request);
                    break;

                case REQUEST_TYPES.HEALTH_CHECK:
                    this.handleHealthCheckMessage(clientId, request);
                    break;

                case REQUEST_TYPES.HEARTBEAT:
                    this.handleHeartbeat(clientId, request);
                    break;

                case REQUEST_TYPES.TOOL_EXECUTE:
                    if (!connection.authenticated) {
                        this.sendResponse(clientId, {
                            version: PROTOCOL_VERSION,
                            requestId: request.requestId,
                            type: RESPONSE_TYPES.ERROR,
                            success: false,
                            error: "Not authenticated",
                            timestamp: getCurrentTimestamp(),
                        });
                    } else {
                        this.handleToolExecute(clientId, request);
                    }
                    break;

                default:
                    this.sendResponse(clientId, {
                        version: PROTOCOL_VERSION,
                        requestId: request.requestId,
                        type: RESPONSE_TYPES.ERROR,
                        success: false,
                        error: `Unknown request type: ${(request as any).type}`,
                        timestamp: getCurrentTimestamp(),
                    });
            }

            connection.requestCount++;
        } catch (error) {
            this.logger.error(
                "Error handling message",
                error instanceof Error ? error : new Error(String(error)),
                { clientId }
            );
            this.sendResponse(clientId, {
                version: PROTOCOL_VERSION,
                requestId: generateRequestId(),
                type: RESPONSE_TYPES.ERROR,
                success: false,
                error: "Internal server error",
                timestamp: getCurrentTimestamp(),
            });
        }
    }

    private handleAuth(clientId: string, request: RemoteRequest): void {
        const connection = this.clients.get(clientId);
        if (!connection) return;

        // Validate the shared server/remote-agent token before authorizing commands.
        const expected = Buffer.from(this.config.remoteAgentToken);
        const actual = Buffer.from(request.token || "");
        const isValid = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

        if (isValid) {
            connection.authenticated = true;
            connection.session.metadata = { authenticatedAt: getCurrentTimestamp() };

            this.sendResponse(clientId, {
                version: PROTOCOL_VERSION,
                requestId: request.requestId,
                type: RESPONSE_TYPES.AUTH,
                success: true,
                result: {
                    authenticated: true,
                    sessionId: connection.session.id,
                    expiresIn: 3600,
                },
                timestamp: getCurrentTimestamp(),
            });

            this.logger.info("Client authenticated", { clientId });
            this.logger.info("AGENT_AUTHENTICATED", { clientId });
        } else {
            this.sendResponse(clientId, {
                version: PROTOCOL_VERSION,
                requestId: request.requestId,
                type: RESPONSE_TYPES.AUTH,
                success: false,
                error: "Authentication failed",
                timestamp: getCurrentTimestamp(),
            });

            this.logger.warn("Authentication failed", { clientId });
            this.logger.warn("AGENT_AUTH_FAILED", { clientId });
            connection.ws.close(1008, "Authentication failed");
        }
    }

    private handleHealthCheckMessage(clientId: string, request: RemoteRequest): void {
        const uptime = Date.now() - this.startTime;

        this.sendResponse(clientId, {
            version: PROTOCOL_VERSION,
            requestId: request.requestId,
            type: RESPONSE_TYPES.HEALTH_CHECK,
            success: true,
            result: {
                status: "ok",
                uptime,
                services: {
                    agent: "ready",
                    memory: "ready",
                    tools: "ready",
                },
            },
            timestamp: getCurrentTimestamp(),
        });
    }

    private handleHeartbeat(clientId: string, request: RemoteRequest): void {
        this.sendResponse(clientId, {
            version: PROTOCOL_VERSION,
            requestId: request.requestId,
            type: RESPONSE_TYPES.HEARTBEAT,
            success: true,
            timestamp: getCurrentTimestamp(),
        });

        this.logger.debug("Heartbeat received", { clientId });
    }

    private handleToolExecute(clientId: string, request: RemoteRequest): void {
        this.sendResponse(clientId, { version: PROTOCOL_VERSION, requestId: request.requestId, type: RESPONSE_TYPES.TOOL_RESULT, success: false, error: "Server does not accept client tool requests", timestamp: getCurrentTimestamp() });
    }

    async executeOnRemoteAgent(tool: string, args: Record<string, unknown>, sessionId: string, requestId: string): Promise<any> {
        const connection = Array.from(this.clients.values()).find((client) => client.authenticated);
        if (!connection) throw new Error(ERROR_CODES.REMOTE_AGENT_OFFLINE);

        const request: RemoteRequest = { version: PROTOCOL_VERSION, requestId, sessionId, type: REQUEST_TYPES.TOOL_EXECUTE, tool, arguments: args, timestamp: getCurrentTimestamp() };
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("Remote agent tool timeout")), this.config.connectionTimeoutMs);
            const listener = (data: WebSocket.Data) => {
                try {
                    const response = JSON.parse(data.toString()) as RemoteResponse;
                    if (response.requestId !== requestId || response.type !== RESPONSE_TYPES.TOOL_RESULT) return;
                    clearTimeout(timer); connection.ws.off("message", listener);
                    if (response.success) resolve(response.result); else reject(new Error(response.error || "Remote tool failed"));
                } catch { /* handled by the regular message handler */ }
            };
            connection.ws.on("message", listener);
            connection.ws.send(JSON.stringify(request));
        });
    }

    private setupHeartbeat(clientId: string): void {
        const interval = setInterval(() => {
            const connection = this.clients.get(clientId);
            if (!connection) {
                clearInterval(interval);
                return;
            }

            if (connection.ws.readyState === WebSocket.OPEN) {
                const heartbeatMessage: RemoteResponse = {
                    version: PROTOCOL_VERSION,
                    requestId: generateRequestId(),
                    type: RESPONSE_TYPES.HEARTBEAT,
                    success: true,
                    timestamp: getCurrentTimestamp(),
                };
                connection.ws.send(JSON.stringify(heartbeatMessage));
            }
        }, this.config.heartbeatIntervalMs);
    }

    private sendResponse(clientId: string, response: RemoteResponse): void {
        const connection = this.clients.get(clientId);
        if (!connection) return;

        if (connection.ws.readyState === WebSocket.OPEN) {
            connection.ws.send(JSON.stringify(response));
        }
    }

    private handleClose(clientId: string): void {
        const connection = this.clients.get(clientId);
        if (connection) {
            this.clients.delete(clientId);
            this.logger.info("AGENT_DISCONNECTED", { clientId });
            this.logger.info("Client disconnected", {
                clientId,
                totalConnections: this.clients.size,
            });
        }
    }

    private handleError(clientId: string, error: Error): void {
        this.logger.error(
            "WebSocket error",
            error,
            { clientId }
        );
    }

    private getRemoteAgentStatus(): "connected" | "offline" | "connecting" {
        return Array.from(this.clients.values()).some((client) => client.authenticated) ? "connected" : "offline";
    }

    private isRemoteAgentConnected(sessionId: string): boolean {
        return Array.from(this.clients.values()).some((client) => client.authenticated && client.session.id === sessionId);
    }

    private handleAgentQuery(req: http.IncomingMessage, res: http.ServerResponse): void {
        let body = "";
        req.on("data", (chunk) => {
            body += chunk.toString();
        });

        req.on("end", async () => {
            try {
                const data = JSON.parse(body);
                const { query, sessionId } = data;

                if (!query || typeof query !== "string") {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: "Invalid query" }));
                    return;
                }

                const turn = await this.agent.processInput(query, sessionId);

                await this.memory.set({ scope: "conversation", key: `turn:${turn.id}`, value: turn, sessionId: sessionId || "default" });

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(turn));

                this.logger.debug("Agent query processed", { sessionId });
            } catch (error) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }));
            }
        });
    }

    private handleVisionAnalyze(req: http.IncomingMessage, res: http.ServerResponse): void {
        this.readBody(req, 20 * 1024 * 1024).then(async (body) => {
            try {
                const data = JSON.parse(body.toString("utf8")) as { data?: string; mimeType?: string; prompt?: string };
                if (!data.data) throw new Error("Vision data is required");
                const result = await this.vision.analyzeScreenshot(Buffer.from(data.data, "base64"), data.mimeType || "image/png", data.prompt);
                res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(result));
            } catch (error) { this.sendHttpError(res, error, 400); }
        }).catch((error) => this.sendHttpError(res, error, 413));
    }

    private handleMemoryList(req: http.IncomingMessage, res: http.ServerResponse): void {
        this.memory.list().then((records) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(records)); }).catch((error) => this.sendHttpError(res, error));
    }

    private handleTranscription(req: http.IncomingMessage, res: http.ServerResponse): void {
        this.readBody(req, 15 * 1024 * 1024).then(async (body) => {
            try {
                const text = await this.speech.transcribe(body, "speech.wav", (req.headers["content-type"] || "audio/wav") as any);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ text }));
            } catch (error) { this.sendHttpError(res, error); }
        }).catch((error) => this.sendHttpError(res, error, 413));
    }

    private handleSynthesis(req: http.IncomingMessage, res: http.ServerResponse): void {
        this.readBody(req, 64 * 1024).then(async (body) => {
            try {
                const data = JSON.parse(body.toString("utf8")) as { text?: string; voice?: string; speed?: number };
                const result = await this.speech.synthesize(data.text || "", { voice: data.voice, speed: data.speed });
                res.writeHead(200, { "Content-Type": result.mimeType, "Content-Length": result.audio.length });
                res.end(result.audio);
            } catch (error) { this.sendHttpError(res, error); }
        }).catch((error) => this.sendHttpError(res, error));
    }

    private readBody(req: http.IncomingMessage, maxBytes: number): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            let size = 0;
            req.on("data", (chunk: Buffer) => { size += chunk.length; if (size > maxBytes) { reject(new Error("Request body too large")); req.destroy(); } else chunks.push(chunk); });
            req.on("end", () => resolve(Buffer.concat(chunks)));
            req.on("error", reject);
        });
    }

    private sendHttpError(res: http.ServerResponse, error: unknown, status = 500): void {
        if (res.headersSent) return;
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Speech request failed" }));
    }

    private handleAgentStats(req: http.IncomingMessage, res: http.ServerResponse): void {
        const stats = {
            agent: this.agent.getStats(),
            tools: this.agent.getToolInfo(),
            planner: this.agent.getPlannerStats(),
            executor: this.agent.getExecutorStats(),
            timestamp: getCurrentTimestamp(),
        };

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(stats));

        this.logger.debug("Agent stats requested");
    }

    private handleAgentConversation(req: http.IncomingMessage, res: http.ServerResponse): void {
        const sessionId = req.url?.split("/").pop() || "";

        const conversation = this.agent.getConversation(sessionId);

        if (!conversation) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Conversation not found" }));
            return;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(conversation));

        this.logger.debug("Agent conversation requested", { sessionId });
    }

    async stop(): Promise<void> {
        this.logger.info("Stopping BOW Server");

        // Close all client connections
        for (const [clientId, connection] of this.clients) {
            connection.ws.close(1000, "Server shutting down");
            this.clients.delete(clientId);
        }

        // Close WebSocket server
        if (this.wsServer) {
            this.wsServer.close();
        }

        // Close HTTP server
        if (this.httpServer) {
            this.httpServer.close();
        }

        this.logger.info("BOW Server stopped");
    }

    getClientCount(): number {
        return this.clients.size;
    }

    getSessionCount(): number {
        return this.sessions.size;
    }
}

export default BOWServer;
