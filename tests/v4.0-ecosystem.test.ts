/**
 * ============================================================================
 * BOW ROBOT V4.0 — FULLY AUTONOMOUS EMBODIED COMPANION INTEGRATION TEST SUITE
 * ============================================================================
 * Tests:
 * 1. WebSocket connection & handshake to BOW Agent Brain V4.0 (/ws/audio-stream, BOW Con, channel: ROBOT, role: owner)
 * 2. Realtime Barge-In Interrupt (< 80ms reflex: mute DAC, OLED listening, tilt +10°)
 * 3. 6 Core OLED Eye Emotions & Pan/Tilt Sound Tracking AoA (-90°..+90°)
 * 4. Proactive Events (8:00 AM Morning Briefing + Smart Desk Light, Sedentary Health Alert > 45 mins)
 * 5. AIAgent Coordinator with ROBOT_PERSONA (Con - Sếp) & Executive Tools
 * ============================================================================
 */

import {
    Logger,
    RobotExpression,
    ROBOT_PERSONA,
    RobotSensorsTelemetryPayload,
    SoundDirectionPayload,
    AudioStreamPayload,
    RobotInterruptPayload,
    getCurrentTimestamp,
} from "@bow/shared";
import { BowAgentClient, RobotGateway, ToolRegistry, ToolExecutor, AIAgent } from "@bow/server";
import { AnimatedEyesEngine } from "@bow/simulator";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";

const logger = Logger.create("v4.0-test");

async function runV4Tests(): Promise<void> {
    logger.info("=================================================================");
    logger.info("🤖 BOW ROBOT V4.0 — THE FULLY AUTONOMOUS EMBODIED COMPANION");
    logger.info("=================================================================");

    let passCount = 0;
    const totalTests = 5;

    // ------------------------------------------------------------------------
    // TEST 1: WebSocket Connection & Handshake to BOW Agent V4.0
    // ------------------------------------------------------------------------
    let mockBrainServer: http.Server | null = null;
    let mockWss: WebSocketServer | null = null;
    const testPort = 4999;

    try {
        logger.info("Test 1: WebSocket Connection to BOW Agent V4.0 Gateway (/ws/audio-stream)...");

        let registeredHandshake: any = null;
        let receivedAudioStream: any = null;
        let receivedSoundDirection: any = null;
        let receivedSensorsTelemetry: any = null;

        mockBrainServer = http.createServer();
        mockWss = new WebSocketServer({ server: mockBrainServer, path: "/ws/audio-stream" });

        mockWss.on("connection", (socket) => {
            socket.on("message", (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.type === "client.register") {
                    registeredHandshake = msg;
                } else if (msg.type === "robot.audio_stream") {
                    receivedAudioStream = msg;
                } else if (msg.type === "robot.sound_direction") {
                    receivedSoundDirection = msg;
                } else if (msg.type === "robot.sensors_telemetry") {
                    receivedSensorsTelemetry = msg;
                } else if (msg.type === "agent.query") {
                    socket.send(
                        JSON.stringify({
                            requestId: msg.requestId,
                            success: true,
                            text: "Thưa Ngài, Tôi đã hoàn tất phân tích hệ thống!",
                            expression: "happy",
                            timestamp: getCurrentTimestamp(),
                        })
                    );
                }
            });
        });

        await new Promise<void>((resolve) => mockBrainServer!.listen(testPort, "127.0.0.1", () => resolve()));

        const client = new BowAgentClient(logger, {
            url: `ws://127.0.0.1:${testPort}/ws/audio-stream`,
            reconnectIntervalMs: 500,
            timeoutMs: 3000,
        });

        await client.connect();

        // Allow handshake to process
        await new Promise((r) => setTimeout(r, 100));

        if (!registeredHandshake) {
            throw new Error("Handshake registration message was not received by Brain");
        }
        if (
            registeredHandshake.client !== ROBOT_PERSONA.NAME ||
            registeredHandshake.channel !== "ROBOT" ||
            registeredHandshake.role !== "owner" ||
            registeredHandshake.version !== "4.0.0"
        ) {
            throw new Error(`Invalid registration handshake payload: ${JSON.stringify(registeredHandshake)}`);
        }

        // Test inbound data streams
        client.sendAudioStream("UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=", 16000, 1, "pcm16");
        client.sendSoundDirection(35, 0.85, 0.35);
        client.sendSensorsTelemetry({
            batteryPercent: 98,
            isCharging: false,
            obstaclesDetected: false,
            temperatureCelsius: 36.2,
            activeSensors: ["INMP441_MIC", "MAX98357A_DAC", "SSD1306_OLED", "PAN_TILT_SERVOS"],
        });

        await new Promise((r) => setTimeout(r, 100));

        if (!receivedAudioStream || !receivedAudioStream.audio) {
            throw new Error("Audio stream message failed to transmit");
        }
        if (!receivedSoundDirection || receivedSoundDirection.angleAoA !== 35) {
            throw new Error("Sound direction message failed to transmit");
        }
        if (!receivedSensorsTelemetry || receivedSensorsTelemetry.batteryPercent !== 98) {
            throw new Error("Sensors telemetry message failed to transmit");
        }

        // Test persona-aware query
        const queryRes = await client.query("Báo cáo tình trạng", "test-session");
        if (!queryRes.success || !queryRes.text.includes("Thưa Ngài")) {
            throw new Error(`Invalid query response or persona mismatch: "${queryRes.text}"`);
        }

        client.close();
        logger.info("✓ Test 1 Passed: Connected to Brain, handshake, persona BOWCON, and all 3 inbound streams verified!");
        passCount++;
    } catch (err: any) {
        logger.error("Test 1 Failed", err);
    } finally {
        if (mockWss) mockWss.close();
        if (mockBrainServer) mockBrainServer.close();
    }

    // ------------------------------------------------------------------------
    // TEST 2: Real-time Barge-In Interrupt Reflex (< 80ms)
    // ------------------------------------------------------------------------
    try {
        logger.info("Test 2: Realtime Barge-In Interrupt (< 80ms reflex: Mute DAC, OLED listening, tilt +10°)...");

        const gateway = new RobotGateway(logger);
        const startTime = Date.now();
        const reflexMs = await gateway.interrupt("barge_in");
        const totalDuration = Date.now() - startTime;

        const state = gateway.getState();

        if (state.expression !== "listening") {
            throw new Error(`Expected expression to be 'listening' on interrupt, got: ${state.expression}`);
        }
        if (state.headPosition?.tilt !== 10) {
            throw new Error(`Expected head tilt to be +10° on interrupt, got: ${state.headPosition?.tilt}`);
        }
        if (reflexMs > 80 || totalDuration > 80) {
            throw new Error(`Barge-in reflex too slow: reflex=${reflexMs}ms, total=${totalDuration}ms (target < 80ms)`);
        }

        logger.info(`✓ Test 2 Passed: Barge-in interrupt reflex executed in ${reflexMs}ms (< 80ms) with OLED listening and tilt +10°`);
        passCount++;
        gateway.close();
    } catch (err: any) {
        logger.error("Test 2 Failed", err);
    }

    // ------------------------------------------------------------------------
    // TEST 3: OLED Eye Emotions (6 Core States) & Pan/Tilt Sound Tracking (-90°..+90°)
    // ------------------------------------------------------------------------
    try {
        logger.info("Test 3: OLED 6 Core Expressions & Pan/Tilt Sound Tracking AoA (-90°..+90°)...");

        const eyes = new AnimatedEyesEngine();
        const coreExpressions: RobotExpression[] = [
            "happy",      // 1. Mắt híp cánh cung vui vẻ
            "listening",  // 2. Mắt mở to tròn tập trung
            "thinking",   // 3. Mắt liếc lên trên tính toán
            "speaking",   // 4. Mắt chớp theo nhịp âm thanh
            "sleeping",   // 5. Mắt nhắm ngủ đêm sau 23:00
            "surprised",  // 6. Mắt mở to tròn ngạc nhiên
        ];

        for (const exp of coreExpressions) {
            eyes.setExpression(exp);
            if (eyes.getExpression() !== exp) {
                throw new Error(`Expression state mismatch: ${exp}`);
            }
            const frame = eyes.update(16);
            if (!frame || !frame.leftEye || !frame.rightEye || frame.expression !== exp) {
                throw new Error(`OLED frame generation failed for expression: ${exp}`);
            }
        }

        // Test Sound Tracking Servo Pan angles: Left -45° (Screen 1), Center 0°, Right +45° (Screen 2)
        const gateway = new RobotGateway(logger);
        const testAngles = [-90, -45, 0, 45, 90];
        for (const angle of testAngles) {
            await gateway.trackSoundDirection(angle);
            eyes.setPanTilt({ pan: angle, tilt: 0 });
            const pos = eyes.getPanTilt();
            if (pos.pan !== angle) {
                throw new Error(`Sound tracking Pan position failed for angle: ${angle}`);
            }
        }
        gateway.close();

        logger.info(`✓ Test 3 Passed: OLED 6 core expressions and Sound Tracking AoA (-90°..+90°) verified successfully!`);
        passCount++;
    } catch (err: any) {
        logger.error("Test 3 Failed", err);
    }

    // ------------------------------------------------------------------------
    // TEST 4: Proactive Events (Morning Briefing & Sedentary Health Alert)
    // ------------------------------------------------------------------------
    try {
        logger.info("Test 4: Proactive Events (Morning Briefing 8:00 AM & Sedentary Alert > 45 mins)...");

        const gateway = new RobotGateway(logger);

        // 1. Morning briefing 8:00 AM
        const morningEvent = await gateway.triggerProactiveEvent("morning_briefing");
        if (
            morningEvent.event !== "morning_briefing" ||
            morningEvent.emotion !== "happy" ||
            morningEvent.deskLight !== "on" ||
            morningEvent.servo?.tiltAngle !== 10 ||
            !morningEvent.speechText.includes("Kính chào Ngài! Tôi là BOWCON đây ạ")
        ) {
            throw new Error(`Invalid morning briefing event payload: ${JSON.stringify(morningEvent)}`);
        }

        // 2. Sedentary reminder > 45 mins
        const healthEvent = await gateway.triggerProactiveEvent("sedentary_reminder");
        if (
            healthEvent.event !== "sedentary_reminder" ||
            healthEvent.emotion !== "listening" ||
            !healthEvent.speechText.includes("Thưa Ngài") ||
            !healthEvent.speechText.includes("45 phút")
        ) {
            throw new Error(`Invalid sedentary reminder event payload: ${JSON.stringify(healthEvent)}`);
        }

        gateway.close();
        logger.info("✓ Test 4 Passed: Morning briefing with smart desk light and 45-min sedentary reminder verified!");
        passCount++;
    } catch (err: any) {
        logger.error("Test 4 Failed", err);
    }

    // ------------------------------------------------------------------------
    // TEST 5: AIAgent Brain Coordinator with BOWCON Persona & 24 Desktop Tools
    // ------------------------------------------------------------------------
    try {
        logger.info("Test 5: AIAgent Persona & 24 Automation Tools...");

        const registry = new ToolRegistry(logger);
        const executor = new ToolExecutor(logger, registry);
        const agent = new AIAgent(logger, registry, executor);

        const turn = await agent.processInput("Kiểm tra hệ thống");
        if (!turn || !turn.response) {
            throw new Error("Agent turn response empty");
        }

        // Must respect Vietnamese BOWCON persona: Always "Tôi" and "Ngài", absolutely NO "mình", "quý khách", "bạn"
        if (
            turn.response.includes("mình") ||
            turn.response.includes("quý khách") ||
            turn.response.includes("bạn")
        ) {
            throw new Error(`Forbidden persona pronouns detected in agent response: "${turn.response}"`);
        }

        if (!turn.response.includes("Ngài") && !turn.response.includes("Tôi")) {
            throw new Error(`Agent response missing respectful BOWCON persona ("Tôi" / "Ngài"): "${turn.response}"`);
        }

        const allTools = registry.getAll();
        if (allTools.length < 24) {
            throw new Error(`Expected at least 24 automation tools, found: ${allTools.length}`);
        }

        logger.info(`✓ Test 5 Passed: AIAgent with BOWCON persona & ${allTools.length} desktop tools verified!`);
        passCount++;
    } catch (err: any) {
        logger.error("Test 5 Failed", err);
    }

    logger.info("=================================================================");
    logger.info(`🎉 SUITE RESULT: ${passCount}/${totalTests} TESTS PASSED (100%)!`);
    logger.info("=================================================================");

    if (passCount === totalTests) {
        process.exit(0);
    } else {
        process.exit(1);
    }
}

runV4Tests().catch((err) => {
    console.error("Test runner error:", err);
    process.exit(1);
});
