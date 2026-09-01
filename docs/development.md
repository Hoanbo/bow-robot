# BOW ROBOT V1.0 - Development Guide

## Project Setup

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+
- Windows 10/11 (for Remote Agent testing)
- Git

### Initial Setup

```bash
# Clone repository
git clone https://github.com/yourusername/bow-robot-v1.git
cd bow-robot-v1

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Build all packages
npm run build
```

### Workspace Structure

This is a **monorepo** using npm workspaces:

```
bow-robot-v1/
├── shared/           # Shared types and utilities
├── bow-server/       # AI Brain
├── bow-remote-agent/ # Computer Hands
├── simulator/        # Robot Simulator
├── tests/            # Test Suite
└── docs/             # Documentation
```

Each workspace is independently versioned but shares common code.

## Development Workflow

### Running in Development Mode

**Terminal 1 - BOW Server:**
```bash
npm run server
# Watches for changes, rebuilds automatically
# Listens on http://localhost:3000
# WebSocket on ws://localhost:3000/ws
```

**Terminal 2 - Remote Agent:**
```bash
npm run agent
# Connects to BOW Server
# Listens for commands on ws://localhost:3000/ws
```

**Terminal 3 - Robot Simulator:**
```bash
npm run simulator
# Visual display of robot state
# Listens for robot commands
```

### Building

```bash
# Build all packages
npm run build

# Build specific package
npm run build --workspace=@bow/server

# Watch mode
npm run dev
```

### Testing

```bash
# Run all tests
npm run test

# Run tests for specific package
npm run test --workspace=@bow/server

# Watch mode
npm run test -- --watch
```

### Code Quality

```bash
# Lint
npm run lint

# Fix linting issues
npm run lint -- --fix

# Format code
npm run format

# Type check
npm run build
```

## Adding New Tools

To add a new tool to the registry:

### 1. Define the Tool

Create `bow-server/src/tools/my-tool.ts`:

```typescript
import { Tool, ToolResult, ToolInputSchema } from "@bow/shared";

export class MyTool implements Tool {
  name = "my_tool";
  description = "Description of what this tool does";
  category = "computer"; // or "browser", "filesystem", etc.
  permissionLevel = "SAFE"; // or "CONFIRM", "BLOCKED"

  inputSchema: ToolInputSchema = {
    type: "object",
    properties: {
      param1: {
        type: "string",
        description: "First parameter"
      },
      param2: {
        type: "number",
        description: "Second parameter"
      }
    },
    required: ["param1"]
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const startTime = Date.now();
    try {
      // Validate arguments
      if (typeof args.param1 !== "string") {
        return {
          success: false,
          action: this.name,
          error: "param1 must be string",
          duration: Date.now() - startTime
        };
      }

      // Execute logic
      const result = await this.performAction(args.param1);

      return {
        success: true,
        action: this.name,
        result: result,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        action: this.name,
        error: error instanceof Error ? error.message : "Unknown error",
        recoverable: true,
        duration: Date.now() - startTime
      };
    }
  }

  private async performAction(param: string): Promise<unknown> {
    // Implementation here
    return { success: true };
  }
}
```

### 2. Register the Tool

In `bow-server/src/tools/registry.ts`:

```typescript
import { MyTool } from "./my-tool.js";

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  constructor() {
    // Register built-in tools
    this.register(new MyTool());
    // ... other tools
  }

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  // ... other methods
}
```

### 3. Write Tests

Create `tests/unit/tools/my-tool.test.ts`:

```typescript
import { test, describe } from "node:test";
import assert from "node:assert";
import { MyTool } from "../../../bow-server/src/tools/my-tool.js";

describe("MyTool", () => {
  test("should execute successfully with valid arguments", async () => {
    const tool = new MyTool();
    const result = await tool.execute({ param1: "test" });
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.action, "my_tool");
  });

  test("should fail with invalid arguments", async () => {
    const tool = new MyTool();
    const result = await tool.execute({ param1: 123 }); // Wrong type
    
    assert.strictEqual(result.success, false);
    assert.match(result.error!, /string/);
  });

  test("should have correct schema", () => {
    const tool = new MyTool();
    assert.strictEqual(tool.permissionLevel, "SAFE");
    assert.ok(tool.inputSchema.properties.param1);
  });
});
```

### 4. Add to Export

In `bow-server/src/tools/index.ts`:

```typescript
export { MyTool } from "./my-tool.js";
export * from "./registry.js";
```

## Project Structure Rules

### TypeScript Configuration

- `strict: true` - No implicit any
- `moduleResolution: "node"` - Use Node.js modules
- Target: `ES2020` - Modern JavaScript

### Module System

- **Use ES modules** (`import`/`export`)
- **No CommonJS** (`require`)
- **Relative imports** for same package
- **Package imports** for cross-package (`@bow/shared`)

### Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Files | lowercase-kebab-case | `tool-registry.ts` |
| Classes | PascalCase | `ToolRegistry` |
| Functions | camelCase | `executeTool()` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES` |
| Interfaces | PascalCase with `I` prefix optional | `Tool` or `ITool` |
| Private members | Leading underscore | `_internalMethod()` |

### File Organization

```
feature/
├── index.ts           # Exports
├── main-class.ts      # Main implementation
├── helper.ts          # Helpers
├── types.ts           # Internal types (if complex)
└── __tests__/
    └── main-class.test.ts
```

## Debugging

### VS Code Debugging

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Launch BOW Server",
      "program": "${workspaceFolder}/bow-server/dist/index.js",
      "preLaunchTask": "npm: build",
      "outFiles": ["${workspaceFolder}/bow-server/dist/**/*.js"],
      "cwd": "${workspaceFolder}",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Launch Tests",
      "program": "${workspaceFolder}/node_modules/.bin/node",
      "args": ["--test", "${workspaceFolder}/tests/dist/**/*.test.js"],
      "outFiles": ["${workspaceFolder}/tests/dist/**/*.js"]
    }
  ]
}
```

### Enable Debug Logging

In `.env`:

```env
LOG_LEVEL=debug
DEBUG=bow:*
```

### Console Debugging

```typescript
import { Logger } from "@bow/shared";

const logger = Logger.create("my-module");

logger.debug("Debug message", { variable: value });
logger.info("Info message");
logger.warn("Warning message");
logger.error("Error message", error);
logger.fatal("Fatal error", error);
```

## Git Workflow

### Branch Naming

- Feature: `feature/description`
- Bug fix: `bugfix/description`
- Hotfix: `hotfix/description`
- Documentation: `docs/description`

### Commit Messages

Use conventional commits:

```
feat: Add new tool registry
fix: Resolve WebSocket connection issue
docs: Update protocol documentation
test: Add safety system tests
chore: Update dependencies
refactor: Simplify agent planning logic
```

### Pull Requests

1. Create feature branch
2. Make changes
3. Run tests: `npm run test`
4. Run linter: `npm run lint`
5. Create PR with description
6. Wait for approval
7. Merge to main

## Performance Optimization

### Profiling

```bash
# Profile memory usage
node --max-old-space-size=4096 dist/index.js

# Profile CPU usage (Node.js 19+)
node --prof dist/index.js
node --prof-process isolate-*.log > profile.txt
```

### Common Bottlenecks

1. **Screenshot capture**: 100-500ms
   - Cache screenshots when possible
   - Compress if not analyzing visually

2. **OCR processing**: 500ms-2s
   - Use smaller regions when possible
   - Cache results

3. **WebSocket messages**: 5-50ms
   - Batch operations
   - Use compression

4. **Tool execution**: Varies
   - Profile individual tools
   - Optimize slow tools

## Testing Best Practices

### Unit Tests

Test individual functions in isolation:

```typescript
test("should handle edge cases", () => {
  const result = myFunction(null);
  assert.ok(result.error);
});
```

### Integration Tests

Test multiple components together:

```typescript
test("should execute tool via registry", async () => {
  const registry = new ToolRegistry();
  const result = await registry.executeTool("screenshot", {});
  assert.strictEqual(result.success, true);
});
```

### E2E Tests

Test complete workflows:

```typescript
test("end-to-end: take screenshot and read text", async () => {
  const screenshot = await remoteAgent.screenshot();
  const text = await visionSystem.extractText(screenshot.data);
  assert.ok(text.length > 0);
});
```

## Documentation

### Code Comments

- Use JSDoc for public APIs
- Explain WHY, not WHAT
- Add examples where helpful

```typescript
/**
 * Execute a tool with arguments
 * @param tool - Tool name
 * @param args - Tool arguments
 * @returns Tool execution result
 * @throws ToolExecutionError if tool fails
 * @example
 * const result = await agent.executeTool("screenshot", {});
 */
async executeTool(tool: string, args: object): Promise<ToolResult>
```

### README Files

- Add to each package
- Include setup instructions
- Document API basics
- Link to detailed docs

### Changelog

Maintain [CHANGELOG.md](./CHANGELOG.md) with major changes:

```markdown
## [1.0.0] - 2026-09-01

### Added
- Initial BOW ROBOT V1.0 release
- BOW Server with AI agent
- Remote Agent for computer control
- WebSocket protocol

### Fixed
- WebSocket connection stability

### Changed
- Improved error messages
```

## Continuous Integration (Future)

Will use GitHub Actions:

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run build
      - run: npm run lint
      - run: npm run test
```

## Release Process

1. **Prepare Release**
   - Update version in package.json
   - Update CHANGELOG.md
   - Create PR with "Release v1.x.x"

2. **Build**
   - `npm run build`
   - Verify all packages built

3. **Test**
   - Run full test suite
   - Manual testing on target platforms

4. **Tag**
   - `git tag v1.x.x`
   - `git push origin --tags`

5. **Deploy**
   - Publish to registry (if applicable)
   - Document release notes

## Troubleshooting

### Common Issues

#### "Cannot find module" errors

```bash
# Clear node_modules and reinstall
npm run clean
npm install
npm run build
```

#### WebSocket connection fails

- Check `.env` configuration
- Verify BOW Server is running
- Check firewall settings
- Look at logs: `LOG_LEVEL=debug`

#### TypeScript compilation errors

```bash
# Rebuild shared module first
npm run build --workspace=@bow/shared

# Then rebuild dependent packages
npm run build
```

#### Tests won't run

```bash
# Ensure tests are built
npm run build --workspace=@bow/tests

# Run with Node test runner
node --test tests/dist/**/*.test.js
```

## Resources

- [Architecture Guide](./architecture.md)
- [WebSocket Protocol](./protocol.md)
- [Safety System](./safety.md)
- [API Reference](./api.md)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Node.js Documentation](https://nodejs.org/docs/)

## Support

For questions or issues:
1. Check existing documentation
2. Search GitHub issues
3. Create new issue with details
4. Contact maintainers

---

**Last Updated:** 2026-09-01  
**Version:** 1.0
