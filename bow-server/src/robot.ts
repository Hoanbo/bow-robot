import { Logger, RobotCommand, RobotState, generateRequestId, getCurrentTimestamp } from "@bow/shared";
import WebSocket from "ws";

/** Provider-agnostic robot gateway; simulator and future ESP32 use this contract. */
export class RobotGateway {
    private socket?: WebSocket;
    private state: RobotState = { mode: "idle", connected: false };
    constructor(private readonly logger: Logger, private readonly url = "ws://127.0.0.1:3002") {}

    async connect(): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            this.socket = new WebSocket(this.url);
            this.socket.once("open", () => { this.state = { ...this.state, connected: true }; resolve(); });
            this.socket.once("error", reject);
            this.socket.on("message", (data) => { try { const message = JSON.parse(data.toString()); if (message.state) this.state = message.state; } catch { this.logger.warn("Invalid robot gateway message"); } });
        });
    }

    async send(type: RobotCommand["type"], parameters: Record<string, unknown> = {}): Promise<void> {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) throw new Error("Robot gateway is offline");
        const command: RobotCommand = { id: generateRequestId(), type, parameters, timestamp: getCurrentTimestamp() };
        this.socket.send(JSON.stringify(command));
    }

    getState(): RobotState { return { ...this.state }; }
    close(): void { this.socket?.close(); this.state = { ...this.state, connected: false }; }
}

export default RobotGateway;
