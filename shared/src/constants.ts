/**
 * Shared Constants for BOW ROBOT V1
 */

// Tool categories
export const TOOL_CATEGORIES = {
    COMPUTER: "computer",
    BROWSER: "browser",
    APPLICATION: "application",
    FILESYSTEM: "filesystem",
    TERMINAL: "terminal",
    VISION: "vision",
    SYSTEM: "system",
    TEST: "test",
} as const;

// Permission levels
export const PERMISSION_LEVELS = {
    SAFE: "SAFE",
    CONFIRM: "CONFIRM",
    BLOCKED: "BLOCKED",
} as const;

// Safe tools (no confirmation needed)
export const SAFE_TOOLS = [
    "screenshot",
    "read_screen",
    "file_search",
    "file_read",
    "browser_open",
    "browser_search",
    "open_application",
    "bow_test",
    "get_health",
];

// Tools that require confirmation
export const CONFIRM_TOOLS = [
    "send_message",
    "send_email",
    "file_edit",
    "file_delete",
    "file_move",
    "terminal_execute",
    "system_shutdown",
    "system_restart",
];

// Blocked tools in V1
export const BLOCKED_TOOLS = [
    "system_format_drive",
    "system_uninstall",
    "bypass_security",
    "disable_antivirus",
];

// Log levels
export const LOG_LEVELS = {
    DEBUG: "debug",
    INFO: "info",
    WARN: "warn",
    ERROR: "error",
    FATAL: "fatal",
} as const;

// Default configuration
export const DEFAULT_CONFIG = {
    LOG_LEVEL: "info" as const,
    BOW_SERVER_HOST: "0.0.0.0",
    BOW_SERVER_PORT: 3000,
    REMOTE_AGENT_HOST: "localhost",
    REMOTE_AGENT_PORT: 3001,
    CONNECTION_TIMEOUT_MS: 30000,
    HEARTBEAT_INTERVAL_MS: 5000,
    MAX_CONNECTIONS: 10,
    SAFETY_ENABLED: true,
    REQUIRE_CONFIRMATION: true,
    ROBOT_MODE: "simulator" as const,
};

// Error codes
export const ERROR_CODES = {
    INVALID_REQUEST: "INVALID_REQUEST",
    TOOL_NOT_FOUND: "TOOL_NOT_FOUND",
    TOOL_EXECUTION_FAILED: "TOOL_EXECUTION_FAILED",
    PERMISSION_DENIED: "PERMISSION_DENIED",
    REMOTE_AGENT_OFFLINE: "REMOTE_AGENT_OFFLINE",
    AUTHENTICATION_FAILED: "AUTHENTICATION_FAILED",
    SESSION_EXPIRED: "SESSION_EXPIRED",
    INVALID_PROTOCOL_VERSION: "INVALID_PROTOCOL_VERSION",
    SAFETY_VIOLATION: "SAFETY_VIOLATION",
    CONFIRMATION_REQUIRED: "CONFIRMATION_REQUIRED",
    TIMEOUT: "TIMEOUT",
    INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

// Robot states
export const ROBOT_STATES = {
    IDLE: "idle",
    LISTENING: "listening",
    THINKING: "thinking",
    EXECUTING: "executing",
    SPEAKING: "speaking",
    ERROR: "error",
} as const;

// Message roles
export const MESSAGE_ROLES = {
    USER: "user",
    ASSISTANT: "assistant",
    SYSTEM: "system",
} as const;

// Request types
export const REQUEST_TYPES = {
    TOOL_EXECUTE: "tool.execute",
    HEALTH_CHECK: "health.check",
    AUTH: "auth",
    HEARTBEAT: "heartbeat",
} as const;

export const PROTOCOL_VERSION = "1.0.0";

// Response types
export const RESPONSE_TYPES = {
    TOOL_RESULT: "tool.result",
    HEALTH_CHECK: "health.check",
    AUTH: "auth",
    ERROR: "error",
    HEARTBEAT: "heartbeat",
} as const;

// Default timeouts (ms)
export const TIMEOUTS = {
    TOOL_EXECUTION: 30000,
    BROWSER_NAVIGATION: 60000,
    SCREENSHOT: 5000,
    FILE_OPERATION: 10000,
    TERMINAL_COMMAND: 30000,
    REMOTE_COMMAND: 30000,
} as const;

// Mouse button types
export const MOUSE_BUTTONS = {
    LEFT: "left",
    RIGHT: "right",
    MIDDLE: "middle",
} as const;

// Keyboard modifiers
export const KEYBOARD_MODIFIERS = {
    CTRL: "ctrl",
    SHIFT: "shift",
    ALT: "alt",
    META: "meta",
} as const;

// Common keyboard keys
export const KEYBOARD_KEYS = {
    ENTER: "Enter",
    ESC: "Escape",
    TAB: "Tab",
    BACKSPACE: "Backspace",
    DELETE: "Delete",
    ARROW_UP: "ArrowUp",
    ARROW_DOWN: "ArrowDown",
    ARROW_LEFT: "ArrowLeft",
    ARROW_RIGHT: "ArrowRight",
    HOME: "Home",
    END: "End",
    PAGE_UP: "PageUp",
    PAGE_DOWN: "PageDown",
    SPACE: " ",
} as const;

// File operation types
export const FILE_OPERATIONS = {
    READ: "read",
    WRITE: "write",
    DELETE: "delete",
    MOVE: "move",
    COPY: "copy",
    SEARCH: "search",
} as const;

// Browser actions
export const BROWSER_ACTIONS = {
    OPEN: "open",
    CLOSE: "close",
    SEARCH: "search",
    NAVIGATE: "navigate",
    BACK: "back",
    FORWARD: "forward",
    REFRESH: "refresh",
    SCREENSHOT: "screenshot",
} as const;

// Session defaults
export const SESSION_DEFAULTS = {
    TTL_MS: 3600000, // 1 hour
    MAX_MESSAGES: 1000,
    MAX_MEMORY_ENTRIES: 10000,
} as const;

// Memory scopes
export const MEMORY_SCOPES = {
    SESSION: "session",
    PERSISTENT: "persistent",
} as const;
