/** BOW Robot Simulator / Robot Gateway development endpoint. */
import { Logger, RobotCommand, RobotState, ROBOT_STATES, generateSessionId, getCurrentTimestamp } from "@bow/shared";
import { WebSocketServer, WebSocket } from "ws";
import process from "process";

const logger = Logger.create("bow-simulator", process.env.LOG_LEVEL as any);
const port = Number(process.env.ROBOT_SIMULATOR_PORT || 3002);
let state: RobotState = { mode: "idle", connected: true, expression: "🙂", battery: 100 };

function broadcast(server: WebSocketServer): void {
    const payload = JSON.stringify({ type: "robot.state", state, timestamp: getCurrentTimestamp() });
    for (const client of server.clients) if (client.readyState === WebSocket.OPEN) client.send(payload);
}

async function handleCommand(command: RobotCommand, server: WebSocketServer): Promise<void> {
    logger.info("Robot command received", { type: command.type });
    if (command.type === "speak") {
        state = { ...state, mode: ROBOT_STATES.SPEAKING };
        broadcast(server);
        logger.info("BOW says", { text: String(command.parameters.text || "") });
        await new Promise((resolve) => setTimeout(resolve, Number(command.parameters.durationMs) || 800));
    } else if (command.type === "listen") state = { ...state, mode: ROBOT_STATES.LISTENING };
    else if (command.type === "set_expression") state = { ...state, expression: String(command.parameters.expression || "🙂") };
    else state = { ...state, mode: ROBOT_STATES.EXECUTING };
    broadcast(server);
    if (state.mode !== ROBOT_STATES.SPEAKING) { state = { ...state, mode: ROBOT_STATES.IDLE }; broadcast(server); }
}

const server = new WebSocketServer({ port });
server.on("connection", (socket) => {
    state = { ...state, connected: true };
    socket.send(JSON.stringify({ type: "robot.state", state, timestamp: getCurrentTimestamp() }));
    socket.on("message", (data) => {
        try { void handleCommand(JSON.parse(data.toString()) as RobotCommand, server); }
        catch (error) { socket.send(JSON.stringify({ type: "robot.error", error: error instanceof Error ? error.message : String(error) })); }
    });
    socket.on("close", () => { state = { ...state, connected: server.clients.size > 0 }; });
});
server.on("listening", () => {
    logger.info("BOW ROBOT SIMULATOR ready", { port, sessionId: generateSessionId(), timestamp: getCurrentTimestamp() });
    console.log(`BOW ROBOT SIMULATOR [${port}] ${state.expression} STATE: IDLE`);
});
server.on("error", (error) => logger.error("Simulator error", error));

process.on("SIGINT", () => { server.close(); process.exit(0); });
process.on("SIGTERM", () => { server.close(); process.exit(0); });
