/**
 * BOW Server Configuration Loader (V4.0)
 * Loads and validates configuration from environment and .env file
 */

import { DEFAULT_CONFIG, LogLevel } from "@bow/shared";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export interface ServerConfig {
    // Environment
    nodeEnv: "development" | "production" | "test";
    logLevel: LogLevel;

    // Server
    host: string;
    port: number;
    version: string;

    // Central Brain (BOW-AGENT V4.0)
    bowAgentWsUrl: string;

    // Remote Agent
    remoteAgentHost: string;
    remoteAgentPort: number;
    remoteAgentToken: string;

    // AI Provider
    aiProvider: string;
    aiApiKey: string;
    aiModel: string;
    aiMaxTokens: number;

    // Vision Provider
    visionProvider: string;
    visionApiKey: string;
    visionModel: string;
    visionEnabled: boolean;

    // Speech Providers
    sttProvider: string;
    sttApiKey: string;
    ttsProvider: string;
    ttsApiKey: string;
    sttModel: string;
    ttsModel: string;
    ttsVoice: string;

    // Robot
    robotEnabled: boolean;
    robotMode: "simulator" | "esp32" | "mock";
    robotSerialPort: string;
    robotBaudRate: number;

    // Memory
    memoryType: "sqlite" | "postgres" | "memory";
    memoryDbPath: string;
    memoryMaxSize: number;

    // Safety
    safetyEnabled: boolean;
    safetyRequireConfirmation: boolean;
    safetyDangerousCommandsBlocked: boolean;
    safetyConfirmationTimeoutMs: number;
    safetyLogEvents: boolean;

    // Logging
    logFilePath?: string;
    logMaxSize: string;
    logBackupCount: number;

    // Testing
    bowTestEnabled: boolean;
    bowTestTimeout: number;

    // Network Security
    serverRequireAuth: boolean;
    serverAllowLocalhostOnly: boolean;
    maxConnections: number;
    connectionTimeoutMs: number;
    heartbeatIntervalMs: number;

    // Development
    debug: string;
    enablePlayground: boolean;
    enableMetrics: boolean;
}

export class ConfigLoader {
    static load(): ServerConfig {
        const config: ServerConfig = {
            // Environment
            nodeEnv: (process.env.NODE_ENV || "development") as ServerConfig["nodeEnv"],
            logLevel: ((process.env.LOG_LEVEL || "info").toLowerCase() as LogLevel),

            // Server
            host: process.env.BOW_SERVER_HOST || DEFAULT_CONFIG.BOW_SERVER_HOST,
            port: parseInt(process.env.BOW_SERVER_PORT || String(DEFAULT_CONFIG.BOW_SERVER_PORT)),
            version: process.env.BOW_SERVER_VERSION || "4.0.0",

            // Central Brain V4.0
            bowAgentWsUrl: process.env.BOW_AGENT_WS_URL || "ws://127.0.0.1:4078/ws/audio-stream",

            // Remote Agent
            remoteAgentHost: process.env.REMOTE_AGENT_HOST || DEFAULT_CONFIG.REMOTE_AGENT_HOST,
            remoteAgentPort: parseInt(process.env.REMOTE_AGENT_PORT || String(DEFAULT_CONFIG.REMOTE_AGENT_PORT)),
            remoteAgentToken: process.env.REMOTE_AGENT_TOKEN || "change-me-to-a-secure-token",

            // AI Provider
            aiProvider: process.env.AI_PROVIDER || "openai",
            aiApiKey: process.env.AI_API_KEY || "",
            aiModel: process.env.AI_MODEL || "gpt-4",
            aiMaxTokens: parseInt(process.env.AI_MAX_TOKENS || "8192"),

            // Vision Provider
            visionProvider: process.env.VISION_PROVIDER || "openai",
            visionApiKey: process.env.VISION_API_KEY || "",
            visionModel: process.env.VISION_MODEL || "gpt-4-vision-preview",
            visionEnabled: process.env.VISION_ENABLED === "true",

            // Speech Providers
            sttProvider: process.env.STT_PROVIDER || "openai",
            sttApiKey: process.env.STT_API_KEY || "",
            ttsProvider: process.env.TTS_PROVIDER || "openai",
            ttsApiKey: process.env.TTS_API_KEY || "",
            sttModel: process.env.STT_MODEL || "gpt-4o-mini-transcribe",
            ttsModel: process.env.TTS_MODEL || "gpt-4o-mini-tts",
            ttsVoice: process.env.TTS_VOICE || "alloy",

            // Robot
            robotEnabled: process.env.ROBOT_ENABLED !== "false",
            robotMode: (process.env.ROBOT_MODE || "simulator") as ServerConfig["robotMode"],
            robotSerialPort: process.env.ROBOT_SERIAL_PORT || "/dev/ttyUSB0",
            robotBaudRate: parseInt(process.env.ROBOT_BAUD_RATE || "115200"),

            // Memory
            memoryType: (process.env.MEMORY_TYPE || "sqlite") as ServerConfig["memoryType"],
            memoryDbPath: process.env.MEMORY_DB_PATH || "./data/memory.db",
            memoryMaxSize: parseInt(process.env.MEMORY_MAX_SIZE || "10000"),

            // Safety
            safetyEnabled: process.env.SAFETY_ENABLED !== "false",
            safetyRequireConfirmation: process.env.SAFETY_REQUIRE_CONFIRMATION !== "false",
            safetyDangerousCommandsBlocked: process.env.SAFETY_DANGEROUS_COMMANDS_BLOCKED !== "false",
            safetyConfirmationTimeoutMs: parseInt(process.env.SAFETY_CONFIRMATION_TIMEOUT || "30000"),
            safetyLogEvents: process.env.SAFETY_LOG_EVENTS !== "false",

            // Logging
            logFilePath: process.env.LOG_FILE_PATH,
            logMaxSize: process.env.LOG_MAX_SIZE || "10MB",
            logBackupCount: parseInt(process.env.LOG_BACKUP_COUNT || "5"),

            // Testing
            bowTestEnabled: process.env.BOW_TEST_ENABLED !== "false",
            bowTestTimeout: parseInt(process.env.BOW_TEST_TIMEOUT || "30000"),

            // Network Security
            serverRequireAuth: process.env.SERVER_REQUIRE_AUTH !== "false",
            serverAllowLocalhostOnly: process.env.SERVER_ALLOW_LOCALHOST_ONLY !== "false",
            maxConnections: parseInt(process.env.MAX_CONNECTIONS || String(DEFAULT_CONFIG.MAX_CONNECTIONS)),
            connectionTimeoutMs: parseInt(process.env.CONNECTION_TIMEOUT || String(DEFAULT_CONFIG.CONNECTION_TIMEOUT_MS)),
            heartbeatIntervalMs: parseInt(process.env.HEARTBEAT_INTERVAL || String(DEFAULT_CONFIG.HEARTBEAT_INTERVAL_MS)),

            // Development
            debug: process.env.DEBUG || "bow:*",
            enablePlayground: process.env.ENABLE_PLAYGROUND !== "false",
            enableMetrics: process.env.ENABLE_METRICS !== "false",
        };

        this.validate(config);
        return config;
    }

    private static validate(config: ServerConfig): void {
        if (config.port < 1 || config.port > 65535) {
            throw new Error(`Invalid server port: ${config.port}`);
        }
        if (config.remoteAgentPort < 1 || config.remoteAgentPort > 65535) {
            throw new Error(`Invalid remote agent port: ${config.remoteAgentPort}`);
        }
        if (config.maxConnections < 1) {
            throw new Error(`Invalid maxConnections: ${config.maxConnections}`);
        }
    }
}

export default ConfigLoader;
