/**
 * BOW REMOTE AGENT V4.0 - Main Entry Point
 * The 🖱️ Hands and 👁️ Screen Vision of the BOW ROBOT Ecosystem
 * Runs on the user's PC to control mouse, keyboard, screen vision, and application automation
 * Synchronized with Gemini Executive Tools & Protected by Sandbox Timeout Guard (3s limit)
 */

import { Logger, getCurrentTimestamp, generateSessionId } from "@bow/shared";
import RemoteAgentClient from "./connection.js";
import MouseController from "./mouse.js";
import KeyboardController from "./keyboard.js";
import ScreenController from "./screen.js";
import ApplicationLauncher from "./launcher.js";
import BrowserController from "./browser.js";
import FileManager from "./files.js";
import TerminalExecutor from "./terminal.js";
import process from "process";
import AudioController from "./audio.js";
import VoiceSession from "./voice.js";

interface AgentConfig {
    serverHost: string;
    serverPort: number;
    token: string;
    logLevel: "debug" | "info" | "warn" | "error" | "fatal";
}

let client: RemoteAgentClient | null = null;
let logger: Logger;
let config: AgentConfig;

const DEFAULT_SANDBOX_TIMEOUT_MS = 3000; // 3-second Sandbox Timeout Guard

async function loadConfig(): Promise<AgentConfig> {
    return {
        serverHost: process.env.BOW_SERVER_HOST || "localhost",
        serverPort: parseInt(process.env.BOW_SERVER_PORT || "3000"),
        token: process.env.REMOTE_AGENT_TOKEN || "change-me-to-a-secure-token",
        logLevel: (process.env.LOG_LEVEL || "info") as AgentConfig["logLevel"],
    };
}

/**
 * Sandbox Timeout Guard: Wraps any tool execution with a strict timeout promise
 */
async function withSandboxTimeoutGuard<T>(
    fn: () => Promise<T>,
    timeoutMs: number = DEFAULT_SANDBOX_TIMEOUT_MS,
    toolName: string
): Promise<T> {
    return Promise.race([
        fn(),
        new Promise<T>((_, reject) =>
            setTimeout(
                () => reject(new Error(`[SANDBOX_TIMEOUT] Tool '${toolName}' exceeded ${timeoutMs}ms limit`)),
                timeoutMs
            )
        ),
    ]);
}

async function main(): Promise<void> {
    try {
        config = await loadConfig();
        logger = Logger.create("bow-remote-agent", config.logLevel);

        logger.info("BOW REMOTE AGENT V4.0 - Starting (Executive Tools & Vision)", {
            serverHost: config.serverHost,
            serverPort: config.serverPort,
            sessionId: generateSessionId(),
        });

        // Initialize input controllers
        const mouse = new MouseController(logger);
        const keyboard = new KeyboardController(logger);

        // Initialize screen/application controllers
        const screen = new ScreenController(logger);
        const launcher = new ApplicationLauncher(logger);

        // Initialize advanced controllers
        const browser = new BrowserController(logger);
        const files = new FileManager(logger);
        const terminal = new TerminalExecutor(logger);
        const audio = new AudioController(logger, {
            inputDevice: process.env.BOW_AUDIO_INPUT_DEVICE,
            outputDevice: process.env.BOW_AUDIO_OUTPUT_DEVICE,
            captureCommand: process.env.BOW_AUDIO_CAPTURE_COMMAND,
            playbackCommand: process.env.BOW_AUDIO_PLAYBACK_COMMAND,
        });

        logger.debug("Controllers initialized for V4.0", {
            input: "mouse, keyboard (Unicode safe)",
            interface: "screen (OCR & Notifications), applications",
            advanced: "browser, files, terminal (Sandbox Guard)",
            audio: "full-duplex audio bridge",
            total: "24 Executive tools ready",
        });

        // Create WebSocket client
        client = new RemoteAgentClient(
            {
                host: config.serverHost,
                port: config.serverPort,
                token: config.token,
                timeoutMs: 30000,
                reconnectAttempts: 0,
                reconnectDelayMs: 1000,
                reconnectMaxDelayMs: 30000,
                heartbeatIntervalMs: 5000,
            },
            logger
        );

        client.setToolHandler(async (tool, args) =>
            executeRemoteTool(tool, args, { mouse, keyboard, screen, launcher, browser, files, terminal, audio })
        );

        // Setup event handlers
        client.on("connected", () => {
            logger.info("Connected to BOW Server Central Brain", {
                timestamp: getCurrentTimestamp(),
            });
        });

        client.on("disconnected", () => {
            logger.warn("AGENT_DISCONNECTED");
        });

        client.on("reconnect_failed", (error: Error) => {
            logger.error("Reconnection failed", error);
        });

        client.on("auth_failed", (error: Error) => {
            logger.error("AGENT_AUTH_FAILED", error);
            process.exit(1);
        });

        client.on("state", (state: string) => {
            logger.info(`AGENT_STATE_${state}`, { state });
        });

        client.on("error", (error: Error) => {
            logger.error("Client error", error);
        });

        logger.info("Connecting to BOW Server...", {
            host: `${config.serverHost}:${config.serverPort}`,
        });

        await client.connect();

        if (process.env.BOW_VOICE_ENABLED === "true") {
            const voice = new VoiceSession(logger, audio, {
                serverHost: config.serverHost,
                serverPort: config.serverPort,
                token: config.token,
                sessionId: generateSessionId(),
                listenDurationMs: parseInt(process.env.BOW_VOICE_LISTEN_MS || "5000"),
            });
            logger.info("Voice mode enabled", { listenDurationMs: process.env.BOW_VOICE_LISTEN_MS || "5000" });
            void runVoiceLoop(voice, logger);
        }

        logger.info("BOW REMOTE AGENT V4.0 is fully operational", {
            serverConnection: "CONNECTED",
            tools: "24 Executive tools synchronized with Gemini Prompts",
            security: "Sandbox Timeout Guard (3000ms max)",
            timestamp: getCurrentTimestamp(),
        });

        // Keep agent running
        await new Promise(() => {});
    } catch (error) {
        if (logger) {
            logger.fatal(
                "BOW REMOTE AGENT startup failed",
                error instanceof Error ? error : new Error(String(error))
            );
        } else {
            console.error("BOW REMOTE AGENT startup failed:", error);
        }
        process.exit(1);
    }
}

/**
 * 24 Executive Tools Handler synchronized with Gemini Prompts
 */
async function executeRemoteTool(tool: string, args: Record<string, unknown>, c: any): Promise<unknown> {
    const customTimeout = Number(args.timeoutMs) || (tool === "screenshot" ? 15000 : DEFAULT_SANDBOX_TIMEOUT_MS);

    return withSandboxTimeoutGuard(
        async () => {
            switch (tool) {
                // Mouse Tools (1-4)
                case "mouse_move":
                    return c.mouse.moveTo(Number(args.x), Number(args.y));
                case "mouse_click":
                    return c.mouse.click(Number(args.x), Number(args.y), (args.button as any) || "left");
                case "mouse_double_click":
                    return c.mouse.doubleClick(Number(args.x), Number(args.y));
                case "mouse_scroll":
                    return c.mouse.scroll((args.direction as "up" | "down") || "down", Number(args.amount) || 3);

                // Keyboard & Chat Automation Tools (5-9)
                case "keyboard_type":
                    return c.keyboard.type(String(args.text || ""), Number(args.delay) || 50);
                case "keyboard_type_safe":
                    return c.keyboard.typeSafe(String(args.text || ""));
                case "safe_chat_reply":
                    return c.keyboard.safeChatReply(String(args.text || ""), args.sendEnter !== false);
                case "keyboard_press":
                    return c.keyboard.press(String(args.key), (args.modifiers as any) || []);
                case "keyboard_hotkey":
                    return c.keyboard.hotkey(String(args.key), (args.modifiers as any) || []);

                // Screen & OCR Vision Tools (10-13)
                case "screenshot":
                    return c.screen.takeScreenshot();
                case "get_screen_info":
                    return c.screen.getScreenInfo();
                case "inspect_screen_ocr":
                    return c.screen.inspectScreenOcr();
                case "inspect_screen_notifications":
                    return c.screen.inspectScreenNotifications();

                // Window & Application Launcher Tools (14-17)
                case "focus_window":
                    return c.launcher.focusWindow(String(args.name || args.target));
                case "get_windows":
                    return c.launcher.getWindows();
                case "open_application":
                case "open_app":
                    return c.launcher.launch(String(args.name || args.target), {
                        args: (args.args as string[]) || [],
                        waitForWindow: true,
                        windowTimeoutMs: 10000,
                    });
                case "open_chrome":
                    return c.launcher.launchChrome(args.url as string | undefined);
                case "close_application":
                case "close_app":
                    return c.launcher.close(String(args.name || args.target));

                // Browser Navigation Tools (18-20)
                case "browser_open":
                case "open_url":
                    return c.browser.open(String(args.url || args.target));
                case "browser_navigate":
                    return c.browser.navigate(String(args.url));
                case "browser_search":
                    return c.browser.search(String(args.query), String(args.engine || "google"));
                case "browser_screenshot":
                    return c.browser.screenshot();

                // Filesystem Tools (21-22)
                case "file_read":
                    return c.files.readFile(String(args.path));
                case "file_write":
                    return c.files.writeFile(String(args.path), String(args.content || ""), Boolean(args.append));
                case "file_list":
                    return c.files.listDirectory(String(args.path || "."));
                case "file_search":
                    return c.files.searchFiles(String(args.pattern), args.path as string | undefined);

                // Terminal & Power Tools (23-24)
                case "terminal_execute":
                    return c.terminal.execute(String(args.command), {
                        cwd: args.cwd as string | undefined,
                        timeout: args.timeout as number | undefined,
                    });
                case "terminal_get_info":
                    return c.terminal.getPlatform();
                case "system_shutdown":
                    return c.terminal.execute(process.platform === "win32" ? "shutdown /s /t 60" : "shutdown -h +1");
                case "system_restart":
                    return c.terminal.execute(process.platform === "win32" ? "shutdown /r /t 60" : "shutdown -r +1");

                default:
                    throw new Error(`Unsupported remote executive tool: ${tool}`);
            }
        },
        customTimeout,
        tool
    );
}

async function runVoiceLoop(voice: VoiceSession, logger: Logger): Promise<void> {
    while (true) {
        try {
            const reply = await voice.runTurn();
            if (reply) logger.info("Voice turn completed", { replyLength: reply.length });
        } catch (error) {
            logger.error("Voice turn failed", error instanceof Error ? error : new Error(String(error)));
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
}

// Handle graceful shutdown
async function shutdown(): Promise<void> {
    if (logger) {
        logger.info("Shutdown signal received, cleaning up...");
    }

    if (client) {
        client.disconnect();
    }

    process.exit(0);
}

process.on("SIGINT", () => {
    shutdown().catch(console.error);
});

process.on("SIGTERM", () => {
    shutdown().catch(console.error);
});

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
