/**
 * BOW ROBOT V4.0 — Robot Gateway Provider
 * Controls Virtual Simulator & Physical ESP32 hardware via WebSocket
 * Supports: Barge-in (<80ms), Sound Tracking AoA (-90..+90°), Proactive Events
 */

import {
    Logger,
    RobotCommand,
    RobotState,
    RobotExpression,
    ServoPosition,
    RobotSensorsTelemetryPayload,
    SoundDirectionPayload,
    ProactiveEventPayload,
    generateRequestId,
    getCurrentTimestamp,
} from "@bow/shared";
import WebSocket from "ws";

export class RobotGateway {
    private socket?: WebSocket;
    private state: RobotState = {
        mode: "idle",
        connected: false,
        expression: "neutral",
        battery: 100,
        voltage: 4.18,
        wifiRssi: -50,
        uptime: 0,
        headPosition: { pan: 0, tilt: 0 },
    };
    private reconnectTimer: NodeJS.Timeout | null = null;
    private isManuallyClosed = false;
    private lastTelemetry?: RobotSensorsTelemetryPayload;

    constructor(
        private readonly logger: Logger,
        private readonly url = process.env.ROBOT_GATEWAY_URL || "ws://127.0.0.1:3002"
    ) {}

    async connect(): Promise<void> {
        this.isManuallyClosed = false;
        return new Promise<void>((resolve) => {
            try {
                this.socket = new WebSocket(this.url);
                this.socket.once("open", () => {
                    this.state = { ...this.state, connected: true };
                    this.logger.info("Connected to Robot Gateway (Simulator / ESP32)", { url: this.url });
                    resolve();
                });
                this.socket.once("error", (err) => {
                    this.logger.debug("Robot Gateway socket error (might be offline)", { error: err.message });
                    resolve(); // do not block server boot
                });
                this.socket.on("message", (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        if (message.state) this.state = message.state;
                        if (message.type === "robot.sensors_telemetry" || message.type === "robot.telemetry") {
                            this.lastTelemetry = message;
                            if (message.battery !== undefined) this.state.battery = message.battery;
                            if (message.headPosition) this.state.headPosition = message.headPosition;
                        }
                    } catch {
                        this.logger.warn("Invalid robot gateway message");
                    }
                });
                this.socket.on("close", () => {
                    this.state = { ...this.state, connected: false };
                    if (!this.isManuallyClosed) {
                        this.scheduleReconnect();
                    }
                });
            } catch (err: any) {
                this.logger.debug("Robot Gateway connection attempt error", { error: err?.message });
                resolve();
            }
        });
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            if (!this.isManuallyClosed) {
                void this.connect();
            }
        }, 3000);
    }

    async send(type: RobotCommand["type"], parameters: Record<string, unknown> = {}): Promise<void> {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.logger.debug("Robot gateway is currently offline, command skipped", { type });
            return;
        }
        const command: RobotCommand = { id: generateRequestId(), type, parameters, timestamp: getCurrentTimestamp() };
        this.socket.send(JSON.stringify(command));
    }

    /**
     * Immediate Barge-in Reflex (< 80ms)
     * 1. Mutes speaker DAC
     * 2. Sets OLED eye to 'listening'
     * 3. Tilts head up 10° to look directly at Sếp
     */
    async interrupt(reason = "barge_in"): Promise<number> {
        const startTime = Date.now();
        const newTilt = 10;
        const currentPan = this.state.headPosition?.pan || 0;

        this.state = {
            ...this.state,
            mode: "listening",
            expression: "listening",
            headPosition: { pan: currentPan, tilt: newTilt },
        };

        await this.send("robot.interrupt", {
            action: "stop_playback",
            reason,
            tiltAngle: newTilt,
            panAngle: currentPan,
            emotion: "listening",
            motors: "stop",
        });

        const reflexDelayMs = Date.now() - startTime;
        this.logger.info(`⚡ [BARGE-IN REFLEX] Executed in ${reflexDelayMs}ms (< 80ms target)`);
        return reflexDelayMs;
    }

    /**
     * Sound Tracking: Auto rotate Pan axis (-90° to +90°) following Sếp's voice AoA
     */
    async trackSoundDirection(angleAoA: number): Promise<void> {
        const clampedAngle = Math.max(-90, Math.min(90, Math.round(angleAoA)));
        const tilt = this.state.headPosition?.tilt || 0;
        this.logger.info(`🎯 [SOUND TRACKING] Rotating Pan towards AoA: ${clampedAngle}°`);
        await this.moveHead(clampedAngle, tilt);
    }

    /**
     * Proactive Events
     * - Morning briefing at 8:00 AM: Head turns to Ngài, OLED happy, speaks briefing, desk_light: 'on'
     * - Health reminder > 45 mins: speaks reminder to stand up, drink water, stretch
     */
    async triggerProactiveEvent(event: "morning_briefing" | "sedentary_reminder", customText?: string): Promise<ProactiveEventPayload> {
        if (event === "morning_briefing") {
            const speechText = customText || "Kính chào Ngài! Tôi là BOWCON đây ạ. Chúc Ngài một ngày làm việc sáng suốt và đắc thắng! Tôi đã bật đèn bàn làm việc cho Ngài.";
            await this.moveHead(0, 10);
            await this.setExpression("happy");
            await this.speak(speechText, 4000);
            const payload: ProactiveEventPayload = {
                type: "robot.proactive_event",
                event: "morning_briefing",
                speechText,
                emotion: "happy",
                deskLight: "on",
                servo: { panAngle: 0, tiltAngle: 10 },
                timestamp: getCurrentTimestamp(),
            };
            await this.send("robot.proactive_event", payload as any);
            return payload;
        } else {
            const speechText = customText || "Thưa Ngài, Ngài đã ngồi lập trình liên tục hơn 45 phút. Kính mong Ngài đứng dậy vươn vai và dùng chút nước để bảo vệ sức khỏe.";
            await this.moveHead(0, 10);
            await this.setExpression("listening");
            await this.speak(speechText, 3500);
            const payload: ProactiveEventPayload = {
                type: "robot.proactive_event",
                event: "sedentary_reminder",
                speechText,
                emotion: "listening",
                servo: { panAngle: 0, tiltAngle: 10 },
                timestamp: getCurrentTimestamp(),
            };
            await this.send("robot.proactive_event", payload as any);
            return payload;
        }
    }

    async setExpression(expression: RobotExpression): Promise<void> {
        this.state = { ...this.state, expression };
        await this.send("set_expression", { expression });
    }

    async moveHead(pan: number, tilt: number): Promise<void> {
        const headPosition: ServoPosition = { pan, tilt };
        this.state = { ...this.state, headPosition };
        await this.send("move_head", { pan, tilt });
    }

    async speak(text: string, durationMs = 1500, audioBase64?: string): Promise<void> {
        await this.send("speak", { text, durationMs, audioBase64 });
    }

    async listen(): Promise<void> {
        await this.send("listen", {});
    }

    getState(): RobotState {
        return { ...this.state };
    }

    getLatestTelemetry(): RobotSensorsTelemetryPayload | undefined {
        return this.lastTelemetry;
    }

    close(): void {
        this.isManuallyClosed = true;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.socket?.close();
        this.state = { ...this.state, connected: false };
    }
}

export default RobotGateway;
