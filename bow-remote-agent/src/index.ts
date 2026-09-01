/**
 * BOW REMOTE AGENT - Main Entry Point
 * The 🖱️ Hands of the BOW ROBOT system
 * Runs on the user's PC to control mouse, keyboard, screen, and applications
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

async function loadConfig(): Promise<AgentConfig> {
    return {
        serverHost: process.env.BOW_SERVER_HOST || "localhost",
        serverPort: parseInt(process.env.BOW_SERVER_PORT || "3000"),
        token: process.env.REMOTE_AGENT_TOKEN || "change-me-to-a-secure-token",
        logLevel: (process.env.LOG_LEVEL || "info") as AgentConfig["logLevel"],
    };
}

async function main(): Promise<void> {
    try {
        // Load configuration
        config = await loadConfig();

        // Create logger
        logger = Logger.create("bow-remote-agent", config.logLevel);

        logger.info("BOW REMOTE AGENT V1.0 - Starting", {
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

        logger.debug("Controllers initialized", {
            input: "mouse, keyboard",
            interface: "screen, applications",
            advanced: "browser, files, terminal",
            audio: "headset audio bridge",
            total: "9 controllers",
        });

        // Create WebSocket client
        client = new RemoteAgentClient(
            {
                host: config.serverHost,
                port: config.serverPort,
                token: config.token,
                timeoutMs: 30000,
                // 0 = unlimited retries with a bounded exponential backoff.
                reconnectAttempts: 0,
                reconnectDelayMs: 1000,
                reconnectMaxDelayMs: 30000,
                heartbeatIntervalMs: 5000,
            },
            logger
        );

        client.setToolHandler(async (tool, args) => executeRemoteTool(tool, args, { mouse, keyboard, screen, launcher, browser, files, terminal, audio }));

        // Setup event handlers
        client.on("connected", () => {
            logger.info("Connected to BOW Server", {
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
            // A bad shared secret is a configuration failure, not a transient
            // network failure. Do not retry indefinitely with invalid auth.
            logger.error("AGENT_AUTH_FAILED", error);
            process.exit(1);
        });

        client.on("state", (state: string) => {
            logger.info(`AGENT_STATE_${state}`, { state });
        });

        client.on("error", (error: Error) => {
            logger.error("Client error", error);
        });

        // Connect to server
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

        logger.info("BOW REMOTE AGENT is ready", {
            serverConnection: "CONNECTED",
            systems: {
                mouse: "ready",
                keyboard: "ready",
                screen: "ready",
                applications: "ready",
            },
            timestamp: getCurrentTimestamp(),
        });

        // Keep agent running
        await new Promise(() => {
            /* wait forever */
        });
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

async function executeRemoteTool(tool: string, args: Record<string, unknown>, c: any): Promise<unknown> {
    switch (tool) {
        case "mouse_move": return c.mouse.moveTo(Number(args.x), Number(args.y));
        case "mouse_click": return c.mouse.click(Number(args.x), Number(args.y), (args.button as any) || "left");
        case "mouse_double_click": return c.mouse.doubleClick(Number(args.x), Number(args.y));
        case "mouse_scroll": return c.mouse.scroll((args.direction as "up" | "down") || "down", Number(args.amount) || 3);
        case "keyboard_type": return c.keyboard.type(String(args.text || ""), Number(args.delay) || 50);
        case "keyboard_press": return c.keyboard.press(String(args.key), (args.modifiers as any) || []);
        case "keyboard_hotkey": return c.keyboard.hotkey(String(args.key), (args.modifiers as any) || []);
        case "screenshot": return c.screen.takeScreenshot();
        case "get_screen_info": return c.screen.getScreenInfo();
        case "focus_window": return c.launcher.focusWindow(String(args.name));
        case "get_windows": return c.launcher.getWindows();
        case "open_application": return c.launcher.launch(String(args.name), { args: (args.args as string[]) || [], waitForWindow: true, windowTimeoutMs: 10000 });
        case "open_chrome": return c.launcher.launchChrome(args.url as string | undefined);
        case "close_application": return c.launcher.close(String(args.name));
        case "browser_open": return c.browser.open(String(args.url));
        case "browser_navigate": return c.browser.navigate(String(args.url));
        case "browser_search": return c.browser.search(String(args.query), String(args.engine || "google"));
        case "browser_screenshot": return c.browser.screenshot();
        case "file_read": return c.files.readFile(String(args.path));
        case "file_write": return c.files.writeFile(String(args.path), String(args.content || ""), Boolean(args.append));
        case "file_list": return c.files.listDirectory(String(args.path || "."));
        case "file_search": return c.files.searchFiles(String(args.pattern), args.path as string | undefined);
        case "terminal_execute": return c.terminal.execute(String(args.command), { cwd: args.cwd as string | undefined, timeout: args.timeout as number | undefined });
        case "terminal_get_info": return c.terminal.getPlatform();
        case "system_shutdown": return c.terminal.execute(process.platform === "win32" ? "shutdown /s /t 60" : "shutdown -h +1");
        case "system_restart": return c.terminal.execute(process.platform === "win32" ? "shutdown /r /t 60" : "shutdown -r +1");
        default: throw new Error(`Unsupported remote tool: ${tool}`);
    }
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
