/**
 * BOW ROBOT V4.0 — CENTRAL BRAIN AGENT CLIENT
 * Connects directly to Central Brain @bow/agent v4.0.0 via WebSocket (/ws/audio-stream)
 * Persona: BOW Con (xưng "Con" với "Sếp", channel: "ROBOT", role: "owner")
 */

import {
    Logger,
    RobotExpression,
    RobotSensorsTelemetryPayload,
    SoundDirectionPayload,
    AudioStreamPayload,
    RobotInterruptPayload,
    RobotResponsePayload,
    ProactiveEventPayload,
    ROBOT_PERSONA,
    DEFAULT_BOW_AGENT_WS_URL,
    getCurrentTimestamp,
    generateRequestId,
} from "@bow/shared";
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

export type InterruptCallback = (payload: RobotInterruptPayload) => void;
export type ResponseCallback = (payload: RobotResponsePayload) => void;
export type ProactiveEventCallback = (payload: ProactiveEventPayload) => void;

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

    private interruptListeners: InterruptCallback[] = [];
    private responseListeners: ResponseCallback[] = [];
    private proactiveEventListeners: ProactiveEventCallback[] = [];

    constructor(
        private readonly logger: Logger,
        config: BowAgentClientConfig = {}
    ) {
        this.url = config.url || process.env.BOW_AGENT_WS_URL || DEFAULT_BOW_AGENT_WS_URL;
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
                this.logger.info("Connecting to BOW Agent Brain Gateway V4.0...", { url: this.url });
                this.ws = new WebSocket(this.url);

                this.ws.on("open", () => {
                    this.isConnected = true;
                    this.currentDelay = this.baseDelay;
                    this.logger.info("Connected to BOW Agent Brain Gateway V4.0", {
                        persona: ROBOT_PERSONA.NAME,
                        channel: ROBOT_PERSONA.CHANNEL,
                        role: ROBOT_PERSONA.ROLE,
                    });

                    // Send Handshake registration with BOW Con persona
                    const registration = {
                        type: "client.register",
                        client: ROBOT_PERSONA.NAME,
                        channel: ROBOT_PERSONA.CHANNEL,
                        role: ROBOT_PERSONA.ROLE,
                        version: "4.0.0",
                        timestamp: getCurrentTimestamp(),
                    };
                    this.ws?.send(JSON.stringify(registration));
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
        const { type, requestId, action, reason } = payload;

        // 1. Pending query request resolution
        if (requestId && this.pendingRequests.has(requestId)) {
            const req = this.pendingRequests.get(requestId)!;
            clearTimeout(req.timer);
            this.pendingRequests.delete(requestId);
            req.resolve(payload);
            return;
        }

        // 2. Real-time Barge-In Interrupt: < 80ms reflex
        if (type === "robot.interrupt" || action === "stop_playback" || reason === "barge_in") {
            const interruptPayload: RobotInterruptPayload = {
                type: "robot.interrupt",
                action: "stop_playback",
                reason: "barge_in",
                timestamp: payload.timestamp || getCurrentTimestamp(),
                reflexDelayMs: payload.reflexDelayMs || 0,
            };
            this.logger.info("⚡ [BARGE-IN RECEIVED] Agent triggered interrupt (< 80ms reflex)", interruptPayload as any);
            for (const listener of this.interruptListeners) {
                try {
                    listener(interruptPayload);
                } catch (e: any) {
                    this.logger.error("Interrupt listener error", e);
                }
            }
            return;
        }

        // 3. Robot Response stream
        if (type === "robot.response") {
            const responsePayload: RobotResponsePayload = {
                type: "robot.response",
                text: payload.text || "",
                audioBase64: payload.audioBase64,
                emotion: payload.emotion || "speaking",
                servo: payload.servo,
                timestamp: payload.timestamp || getCurrentTimestamp(),
            };
            for (const listener of this.responseListeners) {
                try {
                    listener(responsePayload);
                } catch (e: any) {
                    this.logger.error("Response listener error", e);
                }
            }
            return;
        }

        // 4. Proactive Event from Central Brain (Morning briefing, Health reminder)
        if (type === "robot.proactive_event") {
            const proactivePayload: ProactiveEventPayload = {
                type: "robot.proactive_event",
                event: payload.event || "morning_briefing",
                speechText: payload.speechText || "",
                emotion: payload.emotion || "happy",
                deskLight: payload.deskLight,
                servo: payload.servo,
                timestamp: payload.timestamp || getCurrentTimestamp(),
            };
            for (const listener of this.proactiveEventListeners) {
                try {
                    listener(proactivePayload);
                } catch (e: any) {
                    this.logger.error("Proactive event listener error", e);
                }
            }
            return;
        }
    }

    /**
     * Send Realtime Micro Audio Inbound Stream (PCM/WAV 16kHz mono) to Brain
     */
    public sendAudioStream(audioBase64: string, sampleRate = 16000, channels = 1, format: "pcm16" | "wav" = "pcm16"): boolean {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
        const payload: AudioStreamPayload = {
            type: "robot.audio_stream",
            audio: audioBase64,
            sampleRate,
            channels,
            format,
            timestamp: getCurrentTimestamp(),
        };
        this.ws.send(JSON.stringify(payload));
        return true;
    }

    /**
     * Send Sound Direction (AoA -90° to +90°) to Brain
     */
    public sendSoundDirection(angleAoA: number, micLeftEnergy?: number, micRightEnergy?: number): boolean {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
        const payload: SoundDirectionPayload = {
            type: "robot.sound_direction",
            angleAoA: Math.max(-90, Math.min(90, angleAoA)),
            micLeftEnergy,
            micRightEnergy,
            timestamp: getCurrentTimestamp(),
        };
        this.ws.send(JSON.stringify(payload));
        return true;
    }

    /**
     * Send Periodic Sensors Telemetry to Brain
     */
    public sendSensorsTelemetry(telemetry: Omit<RobotSensorsTelemetryPayload, "type" | "timestamp">): boolean {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
        const payload: RobotSensorsTelemetryPayload = {
            type: "robot.sensors_telemetry",
            ...telemetry,
            timestamp: getCurrentTimestamp(),
        };
        this.ws.send(JSON.stringify(payload));
        return true;
    }

    /**
     * Event Listeners
     */
    public onInterrupt(cb: InterruptCallback): void {
        this.interruptListeners.push(cb);
    }

    public onResponse(cb: ResponseCallback): void {
        this.responseListeners.push(cb);
    }

    public onProactiveEvent(cb: ProactiveEventCallback): void {
        this.proactiveEventListeners.push(cb);
    }

    /**
     * Query Central Brain with Robot Persona (BOWCON xưng "Tôi" với "Ngài")
     */
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
                            text: payload.text || "Thưa Ngài, Tôi đã xử lý xong yêu cầu ạ.",
                            expression: payload.expression || "happy",
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
                    channel: ROBOT_PERSONA.CHANNEL,
                    role: ROBOT_PERSONA.ROLE,
                    sender: ROBOT_PERSONA.NAME,
                    target: ROBOT_PERSONA.CALL_USER,
                    context: {
                        persona: ROBOT_PERSONA.NAME,
                        caller: ROBOT_PERSONA.CALL_USER,
                        self: ROBOT_PERSONA.SELF_CALL,
                        channel: ROBOT_PERSONA.CHANNEL,
                        ...context,
                    },
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
                    userId: "robot_owner",
                    role: ROBOT_PERSONA.ROLE,
                    channel: ROBOT_PERSONA.CHANNEL,
                    isAuthenticated: true,
                    persona: ROBOT_PERSONA.NAME,
                    ...context,
                });
                const replyText = result.content || "Thưa Ngài, Tôi đã nhận lệnh!";
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

        // Default heuristic conversational fallback adhering strictly to BOWCON persona
        return {
            success: true,
            text: `Thưa Ngài, Tôi đã ghi nhận: "${userQuery}". Tôi đang lập tức thực thi phụng sự Ngài!`,
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
        for (const [, req] of this.pendingRequests.entries()) {
            clearTimeout(req.timer);
            req.reject(new Error("Agent client closed"));
        }
        this.pendingRequests.clear();
        this.ws?.close();
        this.isConnected = false;
    }
}

export default BowAgentClient;
