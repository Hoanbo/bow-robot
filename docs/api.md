# BOW ROBOT V1.0 - API Reference

## Server Endpoints

### HTTP Endpoints (REST)

#### `GET /health`

Check server health status.

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 3600000,
  "services": {
    "agent": "ready",
    "memory": "ready",
    "tools": "ready",
    "remoteAgent": "connected"
  },
  "timestamp": "2026-09-01T12:00:00Z"
}
```

#### `GET /tools`

List all available tools.

**Response:**
```json
{
  "tools": [
    {
      "name": "screenshot",
      "category": "vision",
      "description": "Capture screenshot of current screen",
      "permissionLevel": "SAFE",
      "inputSchema": {
        "type": "object",
        "properties": {
          "width": { "type": "number" },
          "height": { "type": "number" }
        },
        "required": []
      }
    }
    // ... more tools
  ]
}
```

#### `GET /sessions/:sessionId`

Get session information.

**Response:**
```json
{
  "sessionId": "660e8400-e29b-41d4-a716-446655440001",
  "createdAt": "2026-09-01T11:00:00Z",
  "lastActivity": "2026-09-01T12:00:00Z",
  "requestCount": 42,
  "remoteAgentConnected": true,
  "metadata": {}
}
```

### WebSocket Endpoint

#### `WS /ws`

Primary communication channel. See [Protocol Docs](protocol.md) for message formats.

**Connection Flow:**
1. Connect to `ws://server:3000/ws`
2. Send `auth` request with token
3. Receive authentication response
4. Send `tool.execute` requests
5. Receive `tool.result` responses
6. Send/receive `heartbeat` messages

## Client/Agent API

### Remote Agent Connection

```typescript
interface RemoteAgentClient {
  // Connection management
  connect(server: string, port: number): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Tool execution
  executeTool(tool: string, args: Record<string, any>): Promise<ToolResult>;

  // Health check
  healthCheck(): Promise<HealthCheckResponse>;

  // Event listeners
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
}
```

### AI Agent API

```typescript
interface BOWAgent {
  // Conversation
  processInput(input: string): Promise<string>;
  addMessage(role: string, content: string): Promise<void>;
  getConversation(): Conversation;
  clearConversation(): Promise<void>;

  // Planning
  createPlan(goal: string): Promise<AgentPlan>;
  executePlan(plan: AgentPlan): Promise<PlanResult>;

  // Tool execution
  executeTool(tool: string, args: Record<string, any>): Promise<ToolResult>;
  registerTool(tool: Tool): void;

  // Memory
  remember(key: string, value: any): Promise<void>;
  recall(key: string): Promise<any>;
  forget(key: string): Promise<void>;

  // State
  getContext(): AgentContext;
  setContext(context: Partial<AgentContext>): void;
}
```

### Tool Registry API

```typescript
interface ToolRegistry {
  // Registration
  register(tool: Tool): void;
  unregister(toolName: string): void;

  // Lookup
  getTool(name: string): Tool | undefined;
  getAllTools(): Tool[];
  getToolsByCategory(category: string): Tool[];

  // Validation
  validateInput(tool: string, args: Record<string, any>): boolean;
  getSchema(tool: string): ToolInputSchema | undefined;

  // Safety
  getPermissionLevel(tool: string): PermissionLevel;
  isSafeTool(tool: string): boolean;
  isBlockedTool(tool: string): boolean;
}
```

## Tool Schemas

### Category: Computer Control

#### `screenshot`
```json
{
  "name": "screenshot",
  "inputSchema": {
    "type": "object",
    "properties": {
      "width": { "type": "number", "description": "Desired width" },
      "height": { "type": "number", "description": "Desired height" }
    }
  }
}
```

#### `mouse_click`
```json
{
  "name": "mouse_click",
  "inputSchema": {
    "type": "object",
    "properties": {
      "x": { "type": "number", "description": "X coordinate" },
      "y": { "type": "number", "description": "Y coordinate" },
      "button": { "type": "string", "enum": ["left", "right", "middle"] }
    },
    "required": ["x", "y"]
  }
}
```

#### `keyboard_type`
```json
{
  "name": "keyboard_type",
  "inputSchema": {
    "type": "object",
    "properties": {
      "text": { "type": "string", "description": "Text to type" }
    },
    "required": ["text"]
  }
}
```

### Category: Browser Control

#### `browser_open`
```json
{
  "name": "browser_open",
  "inputSchema": {
    "type": "object",
    "properties": {
      "url": { "type": "string", "description": "URL to navigate to" }
    },
    "required": ["url"]
  }
}
```

### Category: File Operations

#### `file_read`
```json
{
  "name": "file_read",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string", "description": "File path" },
      "encoding": { "type": "string", "default": "utf-8" }
    },
    "required": ["path"]
  }
}
```

### Category: System

#### `open_application`
```json
{
  "name": "open_application",
  "inputSchema": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "description": "Application name or path" },
      "args": { "type": "array", "description": "Command line arguments" }
    },
    "required": ["name"]
  }
}
```

### Category: Testing

#### `bow_test`
```json
{
  "name": "bow_test",
  "inputSchema": {
    "type": "object",
    "properties": {
      "target": { "type": "string", "enum": ["unit", "integration", "e2e", "production"] },
      "filter": { "type": "string", "description": "Test filter pattern" }
    }
  }
}
```

## Memory API

```typescript
interface Memory {
  // Basic operations
  remember(key: string, value: any, options?: MemoryOptions): Promise<void>;
  recall(key: string): Promise<any>;
  forget(key: string): Promise<void>;
  clear(): Promise<void>;

  // Query
  search(query: string): Promise<MemoryEntry[]>;
  getAll(scope?: MemoryScope): Promise<MemoryEntry[]>;
  exists(key: string): Promise<boolean>;

  // Batch operations
  rememberBatch(entries: MemoryEntry[]): Promise<void>;
  recallBatch(keys: string[]): Promise<Record<string, any>>;
  forgetBatch(keys: string[]): Promise<void>;

  // Monitoring
  getSize(): Promise<number>;
  getEntryCount(): Promise<number>;
  getLastModified(key: string): Promise<string>;
}

interface MemoryOptions {
  scope?: "session" | "persistent";
  ttl?: number; // Time to live in milliseconds
  encrypted?: boolean;
}
```

## Safety API

```typescript
interface SafetyManager {
  // Check permission before executing
  checkPermission(tool: string): PermissionLevel;
  requiresConfirmation(tool: string): boolean;

  // Get/set permissions
  grantPermission(tool: string, level: PermissionLevel): void;
  revokePermission(tool: string): void;
  getPermissions(): Map<string, PermissionLevel>;

  // Confirmation handling
  requestConfirmation(tool: string, args: Record<string, any>): Promise<boolean>;
  approveConfirmation(requestId: string): void;
  denyConfirmation(requestId: string): void;

  // Validation
  validateToolExecution(tool: string, args: Record<string, any>): ValidationResult;
  validateArguments(tool: string, args: Record<string, any>): ValidationResult;

  // Logging
  logSecurityEvent(event: SecurityEvent): void;
  getSecurityLog(filter?: LogFilter): Promise<SecurityEvent[]>;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface SecurityEvent {
  timestamp: string;
  type: string; // "tool_requested", "permission_denied", "confirmation_required", etc.
  tool: string;
  status: "approved" | "denied" | "pending" | "executed";
  userId?: string;
  reason?: string;
}
```

## Vision API

```typescript
interface VisionSystem {
  // Screenshot
  takeScreenshot(options?: ScreenshotOptions): Promise<Screenshot>;

  // OCR (Optical Character Recognition)
  extractText(image: Buffer | string): Promise<string[]>;
  analyzeText(image: Buffer | string): Promise<TextAnalysis>;

  // Element detection
  detectElements(image: Buffer | string): Promise<ScreenElement[]>;
  findElement(query: string, image?: Buffer | string): Promise<ScreenElement | null>;

  // Analysis
  analyzeScreen(): Promise<ScreenInfo>;
  compareScreenshots(img1: Buffer, img2: Buffer): Promise<ScreenDifference>;
}

interface ScreenshotOptions {
  width?: number;
  height?: number;
  format?: "png" | "jpeg" | "webp";
  quality?: number;
}

interface TextAnalysis {
  text: string[];
  languages: string[];
  confidence: number;
}

interface ScreenDifference {
  similar: boolean;
  similarity: number; // 0-1
  differences: Rectangle[];
}
```

## Speech API

```typescript
interface SpeechSystem {
  // Text to Speech
  speak(text: string, options?: SpeechOptions): Promise<void>;
  synthesize(text: string): Promise<AudioBuffer>;

  // Speech to Text
  listen(timeoutMs?: number): Promise<string>;
  transcribe(audio: AudioBuffer): Promise<string>;

  // Configuration
  setVoice(voiceId: string): void;
  setLanguage(lang: string): void;
  setRate(rate: number): void; // 0.5 - 2.0
}

interface SpeechOptions {
  voiceId?: string;
  language?: string;
  rate?: number; // Speech rate
  pitch?: number; // Voice pitch
  volume?: number; // 0-1
}
```

## Error Handling

All APIs return errors in standardized format:

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    recoverable: boolean;
    timestamp: string;
  };
}
```

## Rate Limiting

API requests are rate limited:

- **General**: 100 requests/minute per session
- **File Operations**: 10 requests/minute
- **Screenshots**: 30 requests/minute
- **Terminal**: 5 requests/minute

Rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1630501234
```

## Authentication

All WebSocket connections require authentication:

```
1. Connect to WS endpoint
2. Send auth message with token
3. Receive auth response
4. Token included in subsequent requests
```

Tokens expire after 1 hour. Refresh before expiration.

## Pagination

List endpoints support pagination:

```
GET /tools?limit=10&offset=0

Response:
{
  "data": [ ... ],
  "total": 50,
  "limit": 10,
  "offset": 0
}
```

## Versioning

API versioning via URL path:

```
/v1/health
/v1/tools
/v1/sessions
```

Future versions:
```
/v2/health
/v2/tools
/v2/sessions
```

## Webhooks (Future)

V2+ will support webhooks:

```typescript
interface Webhook {
  id: string;
  events: string[]; // e.g., ["tool.executed", "error.occurred"]
  url: string;
  headers?: Record<string, string>;
  active: boolean;
}
```

---

**Last Updated:** 2026-09-01  
**Version:** 1.0
