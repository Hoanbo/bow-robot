/**
 * BOW SERVER - Main Entry Point
 * The 🧠 Brain of the BOW ROBOT system
 */

import { Logger, generateSessionId, getCurrentTimestamp } from "@bow/shared";
import { ConfigLoader, ServerConfig } from "./config.js";
import BOWServer from "./server.js";
import process from "process";

export { ConfigLoader, ServerConfig } from "./config.js";
export { BOWServer } from "./server.js";
export { AIAgent } from "./agent/index.js";
export { ToolRegistry } from "./tools/registry.js";
export { ToolExecutor } from "./tools/executor.js";
export { EdgeTTSSpeechProvider, WhisperSTTProvider, UnifiedSpeechProvider } from "./speech.js";
export { RobotGateway } from "./robot.js";
export { BowAgentClient } from "./agent/bowAgentClient.js";

let server: BOWServer | null = null;
let config: ServerConfig;
let logger: Logger;

async function main(): Promise<void> {
    try {
        // Load configuration
        config = ConfigLoader.load();

        // Create logger
        logger = Logger.create("bow-server", config.logLevel, config.logFilePath);

        logger.info("BOW SERVER V1.0 - Starting up", {
            environment: config.nodeEnv,
            version: config.version,
            host: config.host,
            port: config.port,
        });

        // Initialize BOW Server
        server = new BOWServer(config, logger);

        // Start server
        await server.start();

        logger.info("BOW SERVER is ready", {
            wsEndpoint: `ws://${config.host}:${config.port}/ws`,
            healthEndpoint: `http://${config.host}:${config.port}/health`,
            robotMode: config.robotMode,
            sessionId: generateSessionId(),
            timestamp: getCurrentTimestamp(),
        });

        // Keep server running
        await new Promise(() => {
            /* wait forever */
        });
    } catch (error) {
        if (logger) {
            logger.fatal(
                "BOW SERVER startup failed",
                error instanceof Error ? error : new Error(String(error))
            );
        } else {
            console.error("BOW SERVER startup failed:", error);
        }
        process.exit(1);
    }
}

// Handle graceful shutdown
async function shutdown(): Promise<void> {
    if (logger) {
        logger.info("Shutdown signal received, cleaning up...");
    }

    if (server) {
        await server.stop();
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
