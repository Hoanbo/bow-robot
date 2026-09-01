# BOW ROBOT V1.0 — Software-First AI Computer Assistant

A comprehensive AI computer assistant system with natural language understanding, screen reading, computer control, and robot integration capabilities.

## 🎯 Core Objectives

- **Conversation**: User talks to BOW in natural language
- **Understanding**: BOW comprehends the request
- **Computer Control**: BOW can control mouse, keyboard, applications, and browser
- **Vision**: BOW reads and understands screen content
- **Safety**: All actions respect permission levels and safety policies
- **Robot-Ready**: Architecture supports future ESP32-S3 robot integration

## 🏗️ Architecture Overview

BOW V1 uses a **two-PC architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│                        User                                 │
└────────────────────┬────────────────────────────────────────┘
                     │ (Natural Language)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              BOW SERVER (Xeon PC)                           │
│  🧠 Brain: Agent, Planner, Executor, Memory, Safety       │
└────────────────────┬────────────────────────────────────────┘
                     │ (WebSocket)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           REMOTE AGENT (User's PC)                          │
│  🖱️ Hands: Mouse, Keyboard, Screen, Applications, Browser │
└─────────────────────────────────────────────────────────────┘
```

### Two-PC Mode (Production)

- **Xeon PC**: Runs BOW Server (brain)
- **User's PC**: Runs Remote Agent (hands)
- Communication: Secure WebSocket

### Single-PC Mode (Development)

Both run on the same machine during development and testing.

## 📁 Project Structure

```
BOW-ROBOT/
│
├── bow-server/           # 🧠 AI Brain
│   ├── src/
│   │   ├── agent/        # AI Agent, Planner, Executor
│   │   ├── tools/        # Tool Registry
│   │   ├── memory/       # Memory Management
│   │   ├── safety/       # Safety & Permissions
│   │   ├── vision/       # Screenshot & Vision Processing
│   │   ├── speech/       # STT/TTS Abstractions
│   │   ├── remote/       # Remote Agent Communication
│   │   ├── robot/        # Robot Gateway
│   │   ├── api/          # REST/WebSocket API
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── bow-remote-agent/     # 🖱️ Computer Hands
│   ├── src/
│   │   ├── computer/     # Mouse, Keyboard, Screen
│   │   ├── applications/ # App Launcher
│   │   ├── browser/      # Browser Control
│   │   ├── terminal/     # Terminal Executor
│   │   ├── security/     # Permissions
│   │   ├── connection/   # WebSocket Client
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── shared/               # 📦 Shared Code
│   ├── src/
│   │   ├── types/        # TypeScript Interfaces
│   │   ├── protocol/     # WebSocket Protocol
│   │   ├── constants/    # Shared Constants
│   │   ├── utils/        # Utility Functions
│   │   ├── logger/       # Logging System
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── simulator/            # 🤖 Robot Simulator
│   ├── src/
│   │   ├── ui/           # UI Components
│   │   ├── simulator/    # Robot State
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── tests/                # ✅ Test Suite
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── package.json
│
├── docs/                 # 📚 Documentation
│   ├── architecture.md
│   ├── protocol.md
│   ├── safety.md
│   ├── api.md
│   └── development.md
│
├── scripts/              # 🔧 Build Scripts
│   ├── setup.ts
│   └── dev.ts
│
├── package.json          # Root Package
├── tsconfig.json         # Root TypeScript Config
├── .env.example          # Configuration Template
├── .gitignore
├── README.md
└── LICENSE
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Windows 10/11 (for Remote Agent)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/bow-robot-v1.git
cd bow-robot-v1
```

2. **Install dependencies**

```bash
npm install
```

3. **Setup environment**

```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Run in development mode**

```bash
# Terminal 1: BOW Server
npm run server

# Terminal 2: Remote Agent
npm run agent

# Terminal 3: Robot Simulator
npm run simulator
```

## 📋 Development Phases

### ✅ PHASE 1: Foundation
- Repository structure
- TypeScript setup
- Shared types
- Configuration & logging

### PHASE 2: BOW Server
- Health API
- WebSocket server
- Authentication

### PHASE 3: Remote Agent
- Mouse control
- Keyboard input
- Screen capture
- Application launcher

### PHASE 4: Tool Registry & AI Agent
- Tool registry
- AI agent
- Planner
- Executor

### PHASE 5: Advanced Tools
- Browser control (Playwright)
- Filesystem operations
- Terminal execution

### PHASE 6: Vision
- Screenshot capture
- OCR integration
- Vision analysis

### PHASE 7: Speech
- Speech-to-text
- Text-to-speech
- Conversation loop

### PHASE 8: Memory & Safety
- Memory system
- Safety policies
- User confirmation

### PHASE 9: Robot Simulator
- UI simulation
- Robot gateway
- Simulator protocol

### PHASE 10: BOW TEST
- BOW TEST tool
- Test execution
- Result parsing

### PHASE 11-12: Testing & Local Mode
- Unit tests
- Integration tests
- E2E tests
- Local validation

### PHASE 13: Two-PC Mode
- Xeon deployment
- Remote PC connection
- Two-PC validation

### Current implementation status

Phases 1–5 are implemented in the repository. The remaining production-ready
building blocks are also present: screenshot/vision abstraction, headset
speech endpoints and voice loop, JSON memory with secret-key protection,
safety enforcement, simulator/gateway, BOW TEST adapter, and local validation.
Some provider-specific features (OCR/cloud vision, Playwright browser actions,
and hardware ESP32 transport) remain explicitly disabled until configured.

For local validation, run the three processes in separate terminals and then:

```bash
npm run validate:local
```

For two-PC mode, set `BOW_SERVER_HOST`/`BOW_SERVER_PORT` on the server and
`BOW_SERVER_HOST` plus the shared `REMOTE_AGENT_TOKEN` on the remote agent.
Keep the server port restricted to the LAN firewall and never expose the
Remote Agent endpoint directly to the Internet.

## 🛠️ Available Commands

```bash
# Development
npm run dev              # Run all workspaces in dev mode
npm run server           # Run BOW Server
npm run agent            # Run Remote Agent
npm run simulator        # Run Robot Simulator

# Building
npm run build            # Build all workspaces

# Testing
npm run test             # Run all tests

# Code Quality
npm run lint             # Run ESLint
npm run format           # Format code with Prettier

# Cleanup
npm run clean            # Remove all build artifacts
```

## 📚 Documentation

- [Architecture Guide](docs/architecture.md)
- [WebSocket Protocol](docs/protocol.md)
- [Safety System](docs/safety.md)
- [API Reference](docs/api.md)
- [Development Guide](docs/development.md)

## 🔒 Safety & Permissions

BOW implements a multi-level safety system:

- **SAFE**: No confirmation needed (screenshots, reading files)
- **CONFIRM**: Requires user confirmation (file deletion, shutdown)
- **BLOCKED**: Completely disabled for V1

## 🧠 AI Features

- Natural language understanding
- Multi-step reasoning
- Tool selection & execution
- Error recovery
- Context awareness
- Memory integration

## 🎮 Computer Control Features

- Mouse control (move, click, double-click)
- Keyboard input (type, key press)
- Screenshot capture
- Screen text recognition (OCR)
- Application launching
- Browser automation

## 📊 Observability

All requests include:
- Request ID & session ID
- Timestamp
- Agent decision
- Tool execution
- Latency metrics
- Error tracking

## 🚫 V1 Limitations

The following are NOT included in V1:

- Robot walking
- Autonomous navigation
- SLAM
- Facial recognition
- Third-party API integrations (Facebook, Zalo, Instagram)
- Complex distributed systems
- Local LLM requirement

## 🔮 Future (V2+)

- ESP32-S3 hardware integration
- INMP441 microphone
- MAX98357A speaker
- OLED display
- Servo motors
- Advanced robotics

## 📄 License

MIT

## 👥 Contributing

See [DEVELOPMENT.md](docs/development.md)

---

**Status**: PHASE 1 Complete ✅  
**Last Updated**: 2026-09-01
