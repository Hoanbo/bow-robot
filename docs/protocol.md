# BOW ROBOT V1.0 - WebSocket Protocol

## Overview

BOW V1 uses a **versioned binary-safe WebSocket protocol** for communication between BOW Server and Remote Agent.

The protocol is designed to be:
- **Stateless**: Each message is self-contained
- **Idempotent**: Requests can be safely retried
- **Resilient**: Connection failures don't lose state
- **Observable**: Full request tracing support

## Protocol Version

Current version: **`1`**

All messages must include the protocol version. Future versions can be negotiated during handshake.

## Message Structure

### Request Frame

```typescript
{
  version: "1",           // Protocol version
  requestId: string,      // Unique UUID for this request
  sessionId: string,      // Client session ID
  type: string,           // Request type
  tool?: string,          // Tool name (for tool.execute)
  arguments?: object,     // Tool arguments
  token?: string,         // Authentication token
  timestamp: string       // ISO timestamp
}
```

### Response Frame

```typescript
{
  version: "1",           // Protocol version
  requestId: string,      // Matches request requestId
  type: string,           // Response type
  success: boolean,       // Operation result
  result?: object,        // Response data
  error?: string,         // Error message if failed
  timestamp: string       // ISO timestamp
}
```

## Request Types

### 1. `tool.execute` - Execute a Tool

**Request:**
```json
{
  "version": "1",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "sessionId": "660e8400-e29b-41d4-a716-446655440001",
  "type": "tool.execute",
  "tool": "screenshot",
  "arguments": {
    "width": 1920,
    "height": 1080
  },
  "token": "secure-token-here",
  "timestamp": "2026-09-01T12:00:00Z"
}
```

**Response (Success):**
```json
{
  "version": "1",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "tool.result",
  "success": true,
  "result": {
    "action": "screenshot",
    "success": true,
    "data": "base64-encoded-image-data",
    "width": 1920,
    "height": 1080,
    "mimeType": "image/png",
    "duration": 145
  },
  "timestamp": "2026-09-01T12:00:00.145Z"
}
```

**Response (Error):**
```json
{
  "version": "1",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "tool.result",
  "success": false,
  "error": "TOOL_EXECUTION_ERROR: Screen capture failed",
  "timestamp": "2026-09-01T12:00:00.050Z"
}
```

### 2. `health.check` - Server Health

**Request:**
```json
{
  "version": "1",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "sessionId": "660e8400-e29b-41d4-a716-446655440001",
  "type": "health.check",
  "timestamp": "2026-09-01T12:00:00Z"
}
```

**Response:**
```json
{
  "version": "1",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "health.check",
  "success": true,
  "result": {
    "status": "ok",
    "uptime": 3600000,
    "services": {
      "agent": "ready",
      "memory": "ready",
      "tools": "ready"
    }
  },
  "timestamp": "2026-09-01T12:00:00Z"
}
```

### 3. `auth` - Authentication Handshake

**Request:**
```json
{
  "version": "1",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "sessionId": "660e8400-e29b-41d4-a716-446655440001",
  "type": "auth",
  "token": "secure-token-here",
  "timestamp": "2026-09-01T12:00:00Z"
}
```

**Response (Success):**
```json
{
  "version": "1",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "auth",
  "success": true,
  "result": {
    "authenticated": true,
    "sessionId": "660e8400-e29b-41d4-a716-446655440001",
    "expiresIn": 3600
  },
  "timestamp": "2026-09-01T12:00:00Z"
}
```

**Response (Failure):**
```json
{
  "version": "1",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "auth",
  "success": false,
  "error": "AUTHENTICATION_FAILED: Invalid token",
  "timestamp": "2026-09-01T12:00:00Z"
}
```

### 4. `heartbeat` - Connection Keepalive

**Request (Client → Server):**
```json
{
  "version": "1",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "sessionId": "660e8400-e29b-41d4-a716-446655440001",
  "type": "heartbeat",
  "timestamp": "2026-09-01T12:00:00Z"
}
```

**Response (Server → Client):**
```json
{
  "version": "1",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "heartbeat",
  "success": true,
  "timestamp": "2026-09-01T12:00:00Z"
}
```

## Connection Lifecycle

### 1. Connect
- WebSocket connection established
- Client sends `auth` request
- Server validates token
- Connection ready for commands

### 2. Authenticated
- Client can send `tool.execute` requests
- Server processes and responds
- Heartbeat sent every 5 seconds

### 3. Disconnect
- Either side can close connection gracefully
- In-flight requests receive timeout response
- Client should reconnect after backoff delay

## Error Handling

### Error Codes

| Code | Meaning | Recoverable |
|------|---------|-------------|
| `INVALID_REQUEST` | Malformed message | No |
| `TOOL_NOT_FOUND` | Tool doesn't exist | No |
| `TOOL_EXECUTION_FAILED` | Tool failed to run | Yes |
| `PERMISSION_DENIED` | Tool not allowed | No |
| `REMOTE_AGENT_OFFLINE` | Agent not connected | Yes |
| `AUTHENTICATION_FAILED` | Invalid token | No |
| `SESSION_EXPIRED` | Session TTL exceeded | No |
| `INVALID_PROTOCOL_VERSION` | Version mismatch | No |
| `SAFETY_VIOLATION` | Safety policy blocked | No |
| `CONFIRMATION_REQUIRED` | User must confirm | No |
| `TIMEOUT` | Operation timed out | Yes |
| `INTERNAL_ERROR` | Unexpected error | No |

### Retry Strategy

**Recoverable Errors**: Implement exponential backoff
```
Initial delay: 100ms
Max delay: 10000ms
Backoff factor: 2
Max retries: 3
```

**Non-Recoverable Errors**: Fail immediately

## Timeouts

| Operation | Timeout |
|-----------|---------|
| Authentication | 5 seconds |
| Tool execution | 30 seconds |
| Browser navigation | 60 seconds |
| File operation | 10 seconds |
| Screenshot | 5 seconds |
| Heartbeat | 10 seconds |

If server doesn't respond within timeout, client should:
1. Retry (if recoverable)
2. Close and reconnect
3. Notify user

## Request ID Guarantee

Each request ID must be unique within a session. Server uses request ID to:
- Track execution
- Prevent duplicate processing
- Correlate logs
- Match responses to requests

Client should never reuse request IDs within same session.

## Session Management

### Session Lifecycle

1. **Created**: When `auth` succeeds
2. **Active**: While connected and authenticated
3. **Idle**: No messages for 5+ minutes
4. **Expired**: After 1 hour (configurable)
5. **Closed**: When connection terminates

### Session Data

Stored in server memory, includes:
- Session ID
- Client identification
- Connected time
- Last activity time
- Request count
- Authenticated status

## Heartbeat Protocol

### Why Heartbeat?

- Detect connection failures early
- Keep NAT/firewall connections alive
- Validate authentication still valid
- Measure latency

### Interval

- Every 5 seconds (configurable)
- Bidirectional (both sides can initiate)

### Behavior

If no response to heartbeat within 10 seconds:
- Client: Initiate reconnection
- Server: Mark client offline

## Message Size Limits

- Max request size: 10 MB (for large file transfers)
- Max response size: 50 MB (for large screenshots)
- Max message count per session: 10,000
- Max session duration: 1 hour

Oversized messages should be:
- Rejected with `INVALID_REQUEST` error
- Logged for debugging
- Never stored in session history

## Protocol Versioning

### Future Protocol Changes

If protocol needs to change:

1. **Major version bump** (breaking changes):
   - Server supports both versions
   - Old clients shown deprecation warning
   - Clients given grace period to upgrade

2. **Minor version bump** (backward compatible):
   - Servers understand both versions
   - Clients can use either version

3. **Patch version bump** (bug fixes):
   - No structural changes
   - No version increment

### Version Negotiation

During `auth`, server responds with supported versions:

```json
{
  "supportedVersions": ["1"],
  "recommendedVersion": "1"
}
```

## Security Considerations

### Token Format

- Tokens are opaque strings
- Length: 32-256 characters
- Implementation: UUID or JWT (configurable)
- Transmitted via WebSocket (must use WSS in production)

### Logging

Logs include:
- Request type and tool name
- Execution time
- Success/failure status
- Error messages

Logs DO NOT include:
- Token/credentials
- API keys
- Passwords
- Sensitive file content

### Encryption

For production:
- Use WSS (WebSocket Secure/TLS)
- Enable message compression
- Implement rate limiting
- Validate token on every request

## Examples

### Example 1: Take Screenshot

```javascript
// Client sends
{
  "version": "1",
  "requestId": "abc123",
  "sessionId": "xyz789",
  "type": "tool.execute",
  "tool": "screenshot",
  "arguments": {},
  "token": "my-secure-token",
  "timestamp": "2026-09-01T12:00:00Z"
}

// Server responds
{
  "version": "1",
  "requestId": "abc123",
  "type": "tool.result",
  "success": true,
  "result": {
    "action": "screenshot",
    "success": true,
    "data": "iVBORw0KGgoAAAANSUhE...",
    "width": 1920,
    "height": 1080,
    "mimeType": "image/png",
    "duration": 145
  },
  "timestamp": "2026-09-01T12:00:00.145Z"
}
```

### Example 2: Execute Tool with Error

```javascript
// Client sends
{
  "version": "1",
  "requestId": "def456",
  "sessionId": "xyz789",
  "type": "tool.execute",
  "tool": "open_application",
  "arguments": {
    "name": "nonexistent.exe"
  },
  "token": "my-secure-token",
  "timestamp": "2026-09-01T12:01:00Z"
}

// Server responds
{
  "version": "1",
  "requestId": "def456",
  "type": "tool.result",
  "success": false,
  "error": "TOOL_EXECUTION_FAILED: Application not found",
  "timestamp": "2026-09-01T12:01:00.050Z"
}
```
