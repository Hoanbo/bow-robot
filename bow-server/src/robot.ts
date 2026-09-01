import { Logger, RobotCommand, RobotState, RobotExpression, ServoPosition, generateRequestId, getCurrentTimestamp } from "@bow/shared";
import WebSocket from "ws";

/** Provider-agnostic robot gateway; simulator and future ESP32 use this contract. */
export class RobotGateway {
    private socket?: WebSocket;
    private state: RobotState = { mode: "idle", connected: false, expression: "neutral" };
    private reconnectTimer: NodeJS.Timeout | null = null;
    private isManuallyClosed = false;

    constructor(private readonly logger: Logger, private readonly url = "ws://127.0.0.1:3002") {}

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

    getState(): RobotState { return { ...this.state }; }
    
    close(): void {
        this.isManuallyClosed = true;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.socket?.close();
        this.state = { ...this.state, connected: false };
    }
}

export default RobotGateway;
