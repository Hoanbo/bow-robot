# BOW ROBOT V1.0 - Architecture Guide

## Overview

BOW ROBOT V1.0 is a **software-first AI computer assistant** with a distributed architecture designed for natural language interaction and computer control via UI automation.

The system uses a **two-component architecture** that separates concerns between AI reasoning (Server) and system interaction (Remote Agent).

## System Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                  User / Voice Interface                     │
└─────────────────────┬───────────────────────────────────────┘
                      │ (WebSocket)
                      ▼
┌──────────────────────────────────────────────────────────────┐
│                    BOW SERVER                                │
│                  (Xeon PC) 🧠                               │
├──────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ AI Agent Layer                                          │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ • Conversation Manager                                  │ │
│ │ • Planner (creates execution plans)                     │ │
│ │ • Executor (runs plans step-by-step)                    │ │
│ │ • Tool Router (dispatches to appropriate tools)         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Support Systems                                         │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ • Memory (session + persistent)                         │ │
│ │ • Safety & Permissions                                  │ │
│ │ • Vision Analysis                                       │ │
│ │ • Speech Abstractions (STT/TTS)                         │ │
│ │ • Robot Gateway                                         │ │
│ │ • Logging & Observability                               │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Tool Registry                                           │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ • Open Application          • Browser Control           │ │
│ │ • Mouse/Keyboard Control    • File Operations           │ │
│ │ • Screenshot & OCR          • Terminal Execution        │ │
│ │ • Screen Text Reading       • BOW TEST Runner           │ │
│ └─────────────────────────────────────────────────────────┘ │
└──────────────────────┬───────────────────────────────────────┘
                      │ (WebSocket + Authentication)
                      ▼
┌──────────────────────────────────────────────────────────────┐
│              BOW REMOTE AGENT                                │
│             (User's PC) 🖱️                                  │
├──────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Computer Control Systems                                │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ • Mouse Controller (move, click, drag)                  │ │
│ │ • Keyboard Input (type, press keys, modifiers)          │ │
│ │ • Screen Capturer (screenshot, OCR)                     │ │
│ │ • Application Launcher                                  │ │
│ │ • Browser Automation (Playwright)                       │ │
│ │ • Terminal Executor                                     │ │
│ │ • File Manager                                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Connection Management                                   │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ • WebSocket Client                                      │ │
│ │ • Authentication                                        │ │
│ │ • Heartbeat & Health Monitoring                         │ │
│ │ • Command Validation                                    │ │
│ │ • Result Serialization                                  │ │
│ └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Data Flow

### Typical User Request Flow

```
1. User Speech/Text
   ↓
2. BOW Server receives input
   ↓
3. AI Agent processes request
   ├─ Understand intent
   ├─ Create execution plan
   └─ Identify required tools
   ↓
4. Tool Router selects appropriate tool
   ↓
5. Safety System validates
   ├─ Check permission level
   └─ May require user confirmation
   ↓
6. Send command to Remote Agent via WebSocket
   ↓
7. Remote Agent receives & executes
   ├─ Validate command
   ├─ Execute system action
   └─ Capture result
   ↓
8. Return result to BOW Server
   ↓
9. AI Agent processes result
   ├─ Interpret outcome
   ├─ Update context
   └─ Decide next action
   ↓
10. Generate response to user
    ↓
11. Output via voice/text
```

## Module Organization

### `shared/` - Shared Code
- **types.ts** - Common TypeScript interfaces used across all modules
- **logger.ts** - Centralized logging system
- **constants.ts** - Shared constants and configuration
- **utils.ts** - Utility functions

### `bow-server/` - AI Brain
```
src/
├── agent/
│   ├── agent.ts          # Main AI agent class
│   ├── planner.ts        # Creates execution plans
│   ├── executor.ts       # Executes plans step-by-step
│   ├── conversation.ts   # Manages conversation state
│   └── context.ts        # Agent context & memory
├── tools/
│   ├── registry.ts       # Tool registration system
│   ├── computer.ts       # Mouse, keyboard, screenshot tools
│   ├── browser.ts        # Browser automation tools
│   ├── filesystem.ts     # File operations tools
│   ├── terminal.ts       # Terminal execution tools
│   ├── vision.ts         # Vision/OCR tools
│   └── bow-test.ts       # BOW TEST runner tool
├── memory/
│   ├── memory.ts         # Memory interface
│   └── storage.ts        # SQLite backend
├── safety/
│   ├── policy.ts         # Safety policies
│   ├── permissions.ts    # Permission levels
│   └── confirmation.ts   # User confirmation
├── vision/
│   ├── screenshot.ts     # Screenshot capture
│   ├── ocr.ts            # OCR processing
│   └── analyzer.ts       # Vision analysis
├── speech/
│   ├── stt.ts            # Speech-to-text abstraction
│   └── tts.ts            # Text-to-speech abstraction
├── remote/
│   ├── connection-manager.ts   # Remote agent connection
│   └── command-dispatcher.ts   # Command routing
├── robot/
│   └── gateway.ts        # Robot state management
├── api/
│   ├── routes.ts         # HTTP/WebSocket routes
│   └── server.ts         # Express/WebSocket server
└── index.ts              # Entry point
```

### `bow-remote-agent/` - Computer Hands
```
src/
├── computer/
│   ├── mouse.ts          # Mouse control
│   ├── keyboard.ts       # Keyboard input
│   └── screen.ts         # Screen capture
├── applications/
│   └── launcher.ts       # Application launching
├── browser/
│   └── controller.ts     # Browser automation via Playwright
├── terminal/
│   └── executor.ts       # Terminal command execution
├── security/
│   └── permissions.ts    # Command validation
├── connection/
│   └── websocket.ts      # WebSocket client
└── index.ts              # Entry point
```

### `simulator/` - Robot Simulator
```
src/
├── ui/
│   ├── display.ts        # ASCII/Web UI renderer
│   └── components.ts     # UI components
├── simulator/
│   ├── state.ts          # Robot state management
│   ├── events.ts         # Event handling
│   └── gateway.ts        # Robot gateway implementation
└── index.ts              # Entry point
```

## Key Design Principles

### 1. Separation of Concerns
- **Server**: Reasoning, planning, safety decisions
- **Remote Agent**: Execution, system interaction
- **Shared**: Common types, utilities, constants

### 2. Hardware-Ready Architecture
- Robot abstractions allow easy future hardware integration
- Speech abstractions support multiple TTS/STT providers
- Vision abstractions support multiple vision APIs

### 3. Software-First Development
- V1 runs entirely on software (single or dual PC)
- No hardware dependencies
- ESP32-S3 integration comes in V2+

### 4. Multi-Level Safety
- Permission levels: SAFE, CONFIRM, BLOCKED
- Tool validation before execution
- User confirmation for dangerous actions
- No silent failures

### 5. Observability First
- All actions logged with request ID
- Distributed tracing support
- Performance metrics
- Error tracking

### 6. Resilience
- Error recovery mechanisms
- Retry logic with exponential backoff
- Graceful degradation
- Health checks

## Communication Protocol

### Two-PC Mode (Production)
- **Xeon PC** (BOW Server) ← WebSocket → **User's PC** (Remote Agent)
- Secure authentication required
- Request/Response pattern with request IDs
- Heartbeat monitoring

### Single-PC Mode (Development)
- Same protocol and structure
- Both components on same machine
- Communication via localhost

## Security Model

### Authentication
- Token-based authentication on WebSocket connections
- Server validates client token before accepting commands

### Authorization
- Permission levels define what each tool can do
- Safety system enforces policies
- Some tools require explicit user confirmation

### Data Isolation
- No sensitive data in logs (credentials, API keys)
- Commands validated before execution
- Results sanitized before returning

## Performance Considerations

- Streaming responses for large operations
- Caching for frequently accessed screen data
- Timeout limits to prevent hanging
- Connection pooling for Remote Agent

## Extensibility Points

1. **New Tools**: Add to tool registry with schema
2. **New Vision Providers**: Implement vision abstraction interface
3. **New Speech Providers**: Implement STT/TTS abstractions
4. **New Safety Policies**: Extend safety system
5. **New Platforms**: Implement platform-specific drivers

## Future Evolution (V2+)

- ESP32-S3 hardware integration
- Mobile app as remote interface
- Advanced vision (facial recognition)
- Local LLM support
- Multi-robot coordination
