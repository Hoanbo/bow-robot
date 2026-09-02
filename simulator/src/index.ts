/**
 * BOW Robot Simulator / Virtual Desktop Robot Gateway V4.0 (Port 3002)
 * Serves the interactive 128x64 OLED Cyberpunk Web GUI and bridges audio & commands to BOW Server.
 * Supports Barge-in interrupt, 10 OLED eye expressions, and periodic telemetry.
 */
import { Logger, RobotCommand, RobotState, ROBOT_STATES, generateSessionId, getCurrentTimestamp } from "@bow/shared";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import process from "process";
import { AnimatedEyesEngine } from "./eyes.js";

export { AnimatedEyesEngine } from "./eyes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = Logger.create("bow-simulator", (process.env.LOG_LEVEL || "info") as any);
const port = Number(process.env.ROBOT_SIMULATOR_PORT || 3002);
const bowServerUrl = process.env.BOW_SERVER_HTTP_URL || "http://127.0.0.1:3000";

const eyesEngine = new AnimatedEyesEngine();
let activeSpeakTimeout: NodeJS.Timeout | null = null;

let state: RobotState = {
    mode: "idle",
    connected: true,
    expression: "neutral",
    battery: 95,
    voltage: 4.12,
    wifiRssi: -52,
    uptime: 0,
    headPosition: { pan: 0, tilt: 0 },
};

const startTime = Date.now();

// Locate web static folder (support both src/web and dist/web)
const webDir = fs.existsSync(path.join(__dirname, "web"))
    ? path.join(__dirname, "web")
    : path.join(__dirname, "../src/web");

function broadcast(server: WebSocketServer, payloadObj: any): void {
    const payload = JSON.stringify(payloadObj);
    for (const client of server.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    }
}

function handleInterrupt(server: WebSocketServer): void {
    const startTime = Date.now();
    if (activeSpeakTimeout) {
        clearTimeout(activeSpeakTimeout);
        activeSpeakTimeout = null;
    }
    broadcast(server, { type: "audio.stop", reason: "barge_in", timestamp: getCurrentTimestamp() });

    const newTilt = 10;
    state = {
        ...state,
        mode: ROBOT_STATES.LISTENING,
        expression: "listening",
        headPosition: { pan: state.headPosition?.pan || 0, tilt: newTilt },
    };
    eyesEngine.setExpression("listening");
    eyesEngine.setPanTilt(state.headPosition!);
    const reflexDelayMs = Date.now() - startTime;
    logger.info(`⚡ [BARGE-IN] Reflex executed in ${reflexDelayMs}ms (< 80ms target): Mute DAC, OLED listening, tilt: ${newTilt}°`);
    broadcast(server, {
        type: "robot.interrupt",
        action: "stop_playback",
        reason: "barge_in",
        reflexDelayMs,
        timestamp: getCurrentTimestamp(),
    });
    broadcast(server, { type: "robot.state", state, timestamp: getCurrentTimestamp() });
}

async function handleCommand(command: RobotCommand, server: WebSocketServer): Promise<void> {
    logger.info("Robot command received", { type: command.type });

    if (command.type === "interrupt" || command.type === "robot.interrupt") {
        handleInterrupt(server);
        return;
    }

    if (command.type === "robot.sound_direction") {
        const angle = Number(command.parameters.angleAoA ?? 0);
        const clampedPan = Math.max(-90, Math.min(90, Math.round(angle)));
        const tilt = state.headPosition?.tilt || 0;
        state = { ...state, headPosition: { pan: clampedPan, tilt } };
        eyesEngine.setPanTilt({ pan: clampedPan, tilt });
        logger.info(`🎯 [SOUND TRACKING] Servo Pan tracked voice at ${clampedPan}°`);
        broadcast(server, { type: "robot.state", state, timestamp: getCurrentTimestamp() });
        broadcast(server, {
            type: "robot.sound_direction",
            angleAoA: clampedPan,
            micLeftEnergy: command.parameters.micLeftEnergy,
            micRightEnergy: command.parameters.micRightEnergy,
            timestamp: getCurrentTimestamp(),
        });
        return;
    }

    if (command.type === "robot.proactive_event") {
        const eventName = String(command.parameters.event || "morning_briefing");
        const speechText = String(command.parameters.speechText || "");
        const deskLight = command.parameters.deskLight || (eventName === "morning_briefing" ? "on" : undefined);
        const emotion = (command.parameters.emotion as any) || (eventName === "morning_briefing" ? "happy" : "listening");

        state = {
            ...state,
            expression: emotion,
            headPosition: { pan: 0, tilt: 10 },
        };
        eyesEngine.setExpression(emotion);
        eyesEngine.setPanTilt({ pan: 0, tilt: 10 });

        broadcast(server, { type: "robot.state", state, timestamp: getCurrentTimestamp() });
        broadcast(server, {
            type: "robot.proactive_event",
            event: eventName,
            speechText,
            emotion,
            deskLight,
            servo: { panAngle: 0, tiltAngle: 10 },
            timestamp: getCurrentTimestamp(),
        });

        if (speechText) {
            await handleCommand(
                {
                    id: generateSessionId(),
                    type: "speak",
                    parameters: { text: speechText, expression: emotion, durationMs: Math.max(2000, speechText.length * 75) },
                    timestamp: getCurrentTimestamp(),
                },
                server
            );
        }
        return;
    }

    if (command.type === "speak") {
        if (activeSpeakTimeout) clearTimeout(activeSpeakTimeout);

        state = { ...state, mode: ROBOT_STATES.SPEAKING, expression: "speaking" };
        eyesEngine.setExpression("speaking");
        broadcast(server, { type: "robot.state", state, timestamp: getCurrentTimestamp() });
        broadcast(server, {
            type: "agent.response",
            text: String(command.parameters.text || ""),
            expression: "speaking",
            audioBase64: command.parameters.audioBase64,
            timestamp: getCurrentTimestamp(),
        });

        logger.info("BOW speaks", { text: String(command.parameters.text || "") });
        const duration = Number(command.parameters.durationMs) || 1200;
        activeSpeakTimeout = setTimeout(() => {
            state = { ...state, mode: ROBOT_STATES.IDLE, expression: "neutral" };
            eyesEngine.setExpression("neutral");
            broadcast(server, { type: "robot.state", state, timestamp: getCurrentTimestamp() });
            activeSpeakTimeout = null;
        }, duration);
    } else if (command.type === "listen") {
        state = { ...state, mode: ROBOT_STATES.LISTENING, expression: "listening" };
        eyesEngine.setExpression("listening");
        broadcast(server, { type: "robot.state", state, timestamp: getCurrentTimestamp() });
    } else if (command.type === "set_expression") {
        const exp = String(command.parameters.expression || "neutral");
        state = { ...state, expression: exp };
        eyesEngine.setExpression(exp as any);
        broadcast(server, { type: "robot.state", state, timestamp: getCurrentTimestamp() });
    } else if (command.type === "move_head") {
        const pan = Number(command.parameters.pan || 0);
        const tilt = Number(command.parameters.tilt || 0);
        state = { ...state, headPosition: { pan, tilt } };
        eyesEngine.setPanTilt({ pan, tilt });
        broadcast(server, { type: "robot.state", state, timestamp: getCurrentTimestamp() });
    } else if (command.type === "robot.move") {
        const dir = String(command.parameters.direction || "stop");
        logger.info("Robot move executing", { dir, speed: command.parameters.speed });
        state = { ...state, mode: ROBOT_STATES.EXECUTING };
        broadcast(server, { type: "robot.state", state, timestamp: getCurrentTimestamp() });
        broadcast(server, { type: "robot.move", ...command.parameters, timestamp: getCurrentTimestamp() });
    } else {
        state = { ...state, mode: ROBOT_STATES.EXECUTING };
        broadcast(server, { type: "robot.state", state, timestamp: getCurrentTimestamp() });
    }
}

async function forwardQueryToBowServer(query: string, server: WebSocketServer): Promise<void> {
    try {
        logger.info("Forwarding user query to BOW Server", { query });
        const res = await fetch(`${bowServerUrl}/agent/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, sessionId: "virtual-robot-sim" }),
        });

        if (res.ok) {
            const data = (await res.json()) as any;
            const replyText = data.response || "Thưa Ngài, Tôi đã xử lý xong.";
            const expression = data.expression || "happy";

            let audioBase64: string | undefined;
            try {
                const synthRes = await fetch(`${bowServerUrl}/speech/synthesize`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text: replyText }),
                });
                if (synthRes.ok) {
                    const audioBuffer = Buffer.from(await synthRes.arrayBuffer());
                    audioBase64 = audioBuffer.toString("base64");
                }
            } catch (synthErr) {
                logger.warn("TTS synthesis endpoint unavailable, using browser voice");
            }

            await handleCommand(
                {
                    id: generateSessionId(),
                    type: "speak",
                    parameters: {
                        text: replyText,
                        expression,
                        audioBase64,
                        durationMs: Math.max(1500, replyText.length * 75),
                    },
                    timestamp: getCurrentTimestamp(),
                },
                server
            );
        } else {
            const errText = await res.text();
            broadcast(server, {
                type: "agent.response",
                text: `Thưa Ngài, máy chủ phản hồi lỗi: ${errText}`,
                expression: "error",
                timestamp: getCurrentTimestamp(),
            });
        }
    } catch (err: any) {
        logger.error("Failed to forward query to BOW server", err);
        broadcast(server, {
            type: "agent.response",
            text: `Không thể kết nối BOW Server (${bowServerUrl}). Hãy đảm bảo server đang chạy.`,
            expression: "error",
            timestamp: getCurrentTimestamp(),
        });
    }
}

// HTTP Server for serving Simulator Web Dashboard
const httpServer = http.createServer((req, res) => {
    let filePath = path.join(webDir, req.url === "/" ? "index.html" : req.url || "index.html");

    if (!fs.existsSync(filePath)) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("404 Not Found");
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "text/javascript",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".json": "application/json",
    };

    const contentType = mimeTypes[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
});

// WebSocket Server attached to HTTP Server
const server = new WebSocketServer({ server: httpServer });

server.on("connection", (socket) => {
    state = { ...state, connected: true };
    socket.send(JSON.stringify({ type: "robot.state", state, timestamp: getCurrentTimestamp() }));

    socket.on("message", (data) => {
        try {
            const payload = JSON.parse(data.toString());
            if (payload.type === "user.query" && payload.query) {
                void forwardQueryToBowServer(payload.query, server);
            } else if (payload.type === "robot.interrupt" || payload.type === "interrupt") {
                handleInterrupt(server);
            } else {
                void handleCommand(payload as RobotCommand, server);
            }
        } catch (error) {
            socket.send(
                JSON.stringify({
                    type: "robot.error",
                    error: error instanceof Error ? error.message : String(error),
                })
            );
        }
    });

    socket.on("close", () => {
        state = { ...state, connected: server.clients.size > 0 };
    });
});

// Telemetry heartbeat broadcast every 10s
setInterval(() => {
    const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
    state.uptime = uptimeSec;
    const telemetry = {
        type: "robot.telemetry",
        battery: state.battery,
        voltage: state.voltage,
        wifiRssi: state.wifiRssi,
        uptime: uptimeSec,
        headPosition: state.headPosition,
        expression: state.expression,
        timestamp: getCurrentTimestamp(),
    };
    broadcast(server, telemetry);

    const sensorsTelemetry = {
        type: "robot.sensors_telemetry",
        batteryPercent: state.battery ?? 100,
        isCharging: false,
        obstaclesDetected: false,
        temperatureCelsius: 35.4,
        activeSensors: ["INMP441_MIC", "MAX98357A_DAC", "SSD1306_OLED", "PAN_TILT_SERVOS", "ADC_BATTERY"],
        timestamp: getCurrentTimestamp(),
    };
    broadcast(server, sensorsTelemetry);
}, 10000);

httpServer.listen(port, "0.0.0.0", () => {
    logger.info("BOW ROBOT VIRTUAL SIMULATOR GUI V4.0 ready", {
        port,
        url: `http://localhost:${port}`,
        sessionId: generateSessionId(),
        timestamp: getCurrentTimestamp(),
    });
    console.log(`\n======================================================`);
    console.log(`🤖 BOWCON VIRTUAL SIMULATOR & OLED 128x64 DASHBOARD V4.0`);
    console.log(`🌐 Web UI: http://localhost:${port}`);
    console.log(`======================================================\n`);
});

server.on("error", (error) => logger.error("Simulator WebSocket error", error));

process.on("SIGINT", () => {
    httpServer.close();
    process.exit(0);
});
process.on("SIGTERM", () => {
    httpServer.close();
    process.exit(0);
});
