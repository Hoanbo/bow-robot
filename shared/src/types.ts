/**
 * Core Type Definitions for BOW ROBOT V1
 * Used across all modules (bow-server, bow-remote-agent, simulator)
 */

// ============================================================================
// COMMON TYPES
// ============================================================================

export interface Result<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    timestamp: string;
    requestId: string;
}

export interface ToolResult {
    success: boolean;
    action: string;
    result?: unknown;
    error?: string;
    recoverable?: boolean;
    timestamp: string;
    duration: number;
}

// ============================================================================
// REQUEST/RESPONSE PROTOCOL
// ============================================================================

export interface RemoteRequest {
    version: string;
    requestId: string;
    sessionId: string;
    type: "tool.execute" | "health.check" | "auth" | "heartbeat";
    tool?: string;
    arguments?: Record<string, unknown>;
    token?: string;
    timestamp: string;
}

export interface RemoteResponse {
    version: string;
    requestId: string;
    type: "tool.result" | "health.check" | "auth" | "error" | "heartbeat";
    success: boolean;
    result?: unknown;
    error?: string;
    timestamp: string;
}

// ============================================================================
// TOOL SYSTEM
// ============================================================================

export type PermissionLevel = "SAFE" | "CONFIRM" | "BLOCKED";

export interface ToolInputSchema {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
}

export interface Tool {
    name: string;
    description: string;
    category: string;
    inputSchema?: ToolInputSchema;
    permissionLevel?: PermissionLevel;
    permission?: PermissionLevel;
    handler?: (args: Record<string, unknown>) => Promise<ToolResult>;
    schema?: ToolInputSchema | Record<string, unknown>;
    execute?(args: Record<string, unknown>): Promise<ToolResult>;
}

export interface ToolRegistryEntry {
    name: string;
    description: string;
    category: string;
    permissionLevel: PermissionLevel;
    inputSchema: ToolInputSchema;
}

// ============================================================================
// AGENT TYPES
// ============================================================================

export interface Message {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: string;
}

export interface Conversation {
    id: string;
    sessionId: string;
    messages: Message[];
    createdAt: string;
    updatedAt: string;
    metadata: Record<string, unknown>;
}

export interface AgentPlan {
    id: string;
    goal: string;
    steps: PlanStep[];
    reasoning: string;
    createdAt: string;
}

export interface PlanStep {
    id: string;
    action: string;
    description: string;
    tool?: string;
    arguments?: Record<string, unknown>;
    dependencies: string[];
    order: number;
}

export interface AgentContext {
    sessionId: string;
    userId?: string;
    conversationId: string;
    currentPlan?: AgentPlan;
    memory: Record<string, unknown>;
    screen?: ScreenInfo;
    lastAction?: ToolResult;
    permissions: Map<string, PermissionLevel>;
}

// ============================================================================
// VISION TYPES
// ============================================================================

export interface ScreenInfo {
    width: number;
    height: number;
    text: string[];
    elements: ScreenElement[];
    timestamp: string;
}

export interface ScreenElement {
    type: string;
    text?: string;
    bounds?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    confidence: number;
}

export interface Screenshot {
    data: Buffer;
    width: number;
    height: number;
    mimeType: string;
    timestamp: string;
}

// ============================================================================
// COMPUTER CONTROL TYPES
// ============================================================================

export interface MousePosition {
    x: number;
    y: number;
}

export interface MouseEvent {
    type: "move" | "click" | "double_click" | "right_click" | "scroll";
    position?: MousePosition;
    button?: "left" | "right" | "middle";
    scrollDelta?: number;
    timestamp: string;
}

export interface KeyboardEvent {
    type: "type" | "press" | "release";
    text?: string;
    key?: string;
    modifiers?: ("ctrl" | "shift" | "alt" | "meta")[];
    timestamp: string;
}

// ============================================================================
// APPLICATION TYPES
// ============================================================================

export interface Application {
    name: string;
    path: string;
    icon?: string;
    running: boolean;
    pid?: number;
}

export interface ApplicationLaunchRequest {
    name: string;
    path?: string;
    args?: string[];
    waitForWindow?: boolean;
    timeoutMs?: number;
}

// ============================================================================
// BROWSER TYPES
// ============================================================================

export interface BrowserAction {
    type:
    | "open"
    | "close"
    | "search"
    | "navigate"
    | "back"
    | "forward"
    | "refresh"
    | "screenshot";
    url?: string;
    searchQuery?: string;
    timeoutMs?: number;
}

// ============================================================================
// MEMORY TYPES
// ============================================================================

export interface MemoryEntry {
    key: string;
    value: unknown;
    createdAt: string;
    updatedAt: string;
    ttl?: number;
    scope: "session" | "persistent";
}

// ============================================================================
// SAFETY TYPES
// ============================================================================

export interface PermissionRequest {
    id: string;
    tool: string;
    arguments: Record<string, unknown>;
    reason: string;
    timestamp: string;
    expiresAt: string;
}

export interface PermissionDecision {
    granted: boolean;
    reason?: string;
    timestamp: string;
}

export interface SafetyContext {
    currentUser?: string;
    permissions: Map<string, PermissionLevel>;
    blockedTools: string[];
    confirmationRequired: boolean;
}

// ============================================================================
// ROBOT GATEWAY TYPES
// ============================================================================

export type RobotExpression =
    | "neutral"
    | "blink"
    | "happy"
    | "thinking"
    | "surprised"
    | "sleeping"
    | "listening"
    | "speaking"
    | "error";

export interface ServoPosition {
    pan: number;  // Horizontal angle: -90 to +90 degrees (or 0 to 180)
    tilt: number; // Vertical angle: -45 to +45 degrees (or 45 to 135)
}

export interface RobotState {
    mode: "idle" | "listening" | "thinking" | "executing" | "speaking" | "error";
    expression?: RobotExpression | string;
    battery?: number;
    headPosition?: ServoPosition;
    connected: boolean;
    lastAudioLevel?: number;
}

export interface RobotCommand {
    id: string;
    type: "move_head" | "move_arm" | "speak" | "listen" | "set_expression" | "desktop_action" | "stop";
    parameters: Record<string, unknown>;
    timestamp: string;
}

export interface DesktopActionPayload {
    action:
        | "open_app"
        | "open_chrome"
        | "open_url"
        | "browser_search"
        | "mouse_click"
        | "mouse_move"
        | "mouse_scroll"
        | "keyboard_type"
        | "keyboard_press"
        | "keyboard_hotkey"
        | "screenshot"
        | "get_screen_info"
        | "get_windows"
        | "focus_window"
        | "close_app"
        | "file_read"
        | "file_write"
        | "file_list"
        | "terminal_execute"
        | "system_shutdown"
        | "system_restart";
    target?: string;
    query?: string;
    url?: string;
    text?: string;
    key?: string;
    x?: number;
    y?: number;
    command?: string;
    path?: string;
    content?: string;
    modifiers?: string[];
    [key: string]: unknown;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class BOWError extends Error {
    constructor(
        public code: string,
        message: string,
        public recoverable: boolean = false
    ) {
        super(message);
        this.name = "BOWError";
    }
}

export class ToolExecutionError extends BOWError {
    constructor(message: string, recoverable: boolean = false) {
        super("TOOL_EXECUTION_ERROR", message, recoverable);
        this.name = "ToolExecutionError";
    }
}

export class RemoteAgentError extends BOWError {
    constructor(message: string, recoverable: boolean = true) {
        super("REMOTE_AGENT_ERROR", message, recoverable);
        this.name = "RemoteAgentError";
    }
}

export class SafetyError extends BOWError {
    constructor(message: string) {
        super("SAFETY_ERROR", message, false);
        this.name = "SafetyError";
    }
}

// ============================================================================
// LOGGING TYPES
// ============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    category: string;
    message: string;
    data?: Record<string, unknown>;
    requestId?: string;
    sessionId?: string;
    error?: {
        code: string;
        message: string;
        stack?: string;
    };
}

// ============================================================================
// HEALTH CHECK TYPES
// ============================================================================

export interface ServiceStatus {
    status: "ready" | "degraded" | "offline";
    lastCheck: string;
    latency?: number;
    error?: string;
}

export interface HealthCheckResponse {
    status: "ok" | "degraded" | "offline";
    version: string;
    services: Record<string, ServiceStatus>;
    timestamp: string;
    uptime: number;
}

// ============================================================================
// SESSION TYPES
// ============================================================================

export interface Session {
    id: string;
    userId?: string;
    createdAt: string;
    updatedAt: string;
    expiresAt: string;
    metadata: Record<string, unknown>;
}

export interface SessionInfo {
    sessionId: string;
    startTime: string;
    requestCount: number;
    lastActivity: string;
    remoteAgentConnected: boolean;
}
