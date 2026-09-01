# BOW ROBOT V1.0 - Safety System

## Overview

BOW implements a **multi-level safety system** to ensure that potentially dangerous operations cannot be performed without proper authorization.

The system operates on three core principles:
1. **Fail-safe**: Operations don't proceed unless explicitly validated
2. **Transparent**: Users always know what BOW is doing
3. **Revocable**: Users can always cancel operations

## Permission Levels

### SAFE - No Confirmation Needed

Operations that read-only or are universally safe:

- `screenshot` - Capture screen
- `read_screen` - Read text from screen
- `file_search` - Search for files
- `file_read` - Read file contents
- `browser_open` - Open browser
- `browser_search` - Perform web search
- `open_application` - Launch application
- `bow_test` - Run test suite
- `get_health` - System health check

**Processing:**
1. Validate tool exists
2. Validate input arguments
3. Execute immediately
4. Return result

### CONFIRM - User Confirmation Required

Operations that can modify state or send data:

- `send_message` - Send chat message
- `send_email` - Send email
- `file_write` - Write to file
- `file_edit` - Edit file
- `file_delete` - Delete file
- `file_move` - Move/rename file
- `terminal_execute` - Run terminal command
- `system_shutdown` - Shut down computer
- `system_restart` - Restart computer

**Processing:**
1. Validate tool exists
2. Validate input arguments
3. **Request user confirmation**
   - Show what will happen
   - Wait for approval
4. Execute if approved
5. Return result (or cancellation notice)

### BLOCKED - Completely Disabled

Operations too dangerous or not needed in V1:

- `system_format_drive` - Format entire drive
- `system_uninstall` - Uninstall system software
- `bypass_security` - Disable security features
- `disable_antivirus` - Turn off antivirus
- `delete_system_files` - Delete critical files
- `modify_registry` - Windows registry editing
- `factory_reset` - Reset to factory defaults

**Processing:**
1. Reject immediately
2. Log security event
3. Return error to user

## Safety Validation Pipeline

Every tool execution follows this path:

```
Tool Request
    ↓
1. Syntax Validation
   • Is JSON valid?
   • Are required fields present?
   ↓
2. Tool Validation
   • Does tool exist?
   • Is it implemented in V1?
   ↓
3. Argument Validation
   • Do arguments match schema?
   • Are types correct?
   ↓
4. Permission Check
   • Does user have permission?
   • Is tool blocked?
   ↓
5. Confirmation Check
   • Does tool need confirmation?
   • Has user approved?
   ↓
6. Execute Tool
   • Run on Remote Agent
   • Capture result
   ↓
7. Result Validation
   • Did it succeed?
   • Any errors?
   ↓
8. Return Result
```

## User Confirmation Flow

For `CONFIRM` level tools:

### Step 1: Request comes in
```
User: "BOW, send a message to Alice"
↓
Server receives tool request: send_message
Arguments: {recipient: "Alice", message: "Hello"}
```

### Step 2: Server validates and pauses
```
Safety system identifies:
- Tool: send_message
- Level: CONFIRM
- Action: Send message to Alice
↓
Server needs user approval
```

### Step 3: Server requests confirmation
```
BOW says: "I'm about to send a message to Alice saying 'Hello'. 
Is that correct?"
↓
Waiting for user response...
```

### Step 4: User approves or denies
```
User: "Yes, send it"
↓
Execution proceeds
```

OR

```
User: "No, cancel"
↓
Operation cancelled
Result returned: "User cancelled operation"
```

### Step 5: Confirmation expires
```
If user doesn't respond within 30 seconds:
- Operation cancelled
- Result: "Confirmation timeout"
- Logged: "User confirmation timeout for send_message"
```

## Safety Configuration

### Runtime Options

In `.env`:

```env
# Enable/disable entire safety system
SAFETY_ENABLED=true

# Require confirmation for CONFIRM-level tools
SAFETY_REQUIRE_CONFIRMATION=true

# Block all dangerous commands
SAFETY_DANGEROUS_COMMANDS_BLOCKED=true

# Confirmation timeout (milliseconds)
SAFETY_CONFIRMATION_TIMEOUT=30000

# Log security events
SAFETY_LOG_EVENTS=true
```

### Permission Override

In special cases, administrators can:
1. Add user to trusted list
2. Grant temporary permissions
3. Whitelist specific operations

**Never** disable safety without explicit admin action.

## Safety Events & Logging

Every safety-related event is logged:

```json
{
  "timestamp": "2026-09-01T12:00:00Z",
  "level": "info",
  "category": "safety",
  "message": "Tool execution request",
  "data": {
    "requestId": "abc123",
    "tool": "send_message",
    "permissionLevel": "CONFIRM",
    "status": "pending_confirmation",
    "arguments": {
      "recipient": "Alice",
      "message": "[redacted]"
    }
  }
}
```

### Logged Events

- ✓ Tool request received
- ✓ Permission level checked
- ✓ Confirmation requested
- ✓ User approved/denied
- ✓ Tool executed
- ✓ Access denied (blocked tools)
- ✓ Invalid arguments
- ⚠️ Never logged: Credentials, tokens, sensitive data

## Tool-Specific Safety Policies

### `send_message` & `send_email`

**Risks:**
- Sending to wrong recipient
- Sending sensitive information
- Spam/harassment

**Controls:**
1. Require explicit recipient confirmation
2. Show message preview before sending
3. Limit message size
4. Log all sent messages
5. Rate limiting (max 10 per minute)

**Example:**
```
BOW: "About to send email to alice@example.com:
Subject: Project Update
Body: The report is complete..."

User: "Approved" or "Modify" or "Cancel"
```

### `file_delete` & `file_move`

**Risks:**
- Deleting critical files
- Losing data permanently
- Corrupting system

**Controls:**
1. Show exact file path
2. Show file size
3. Warn about system files
4. Require confirmation
5. Don't delete to trash first option
6. Create backup before deletion

**Example:**
```
BOW: "Delete C:\Users\User\Documents\report.docx (1.2 MB)?
This cannot be undone."

User: "Delete" or "Cancel" or "Move to trash first"
```

### `terminal_execute`

**Risks:**
- Arbitrary code execution
- System damage
- Data deletion
- Privilege escalation

**Controls:**
1. Whitelist safe commands initially
2. Show full command before execution
3. Display current working directory
4. Require confirmation
5. Timeout execution after 30 seconds
6. Capture all output (read-only mode)

**Example:**
```
BOW: "Execute terminal command:
pwd

In directory: C:\Users\User"

User: "Execute" or "Cancel" or "Edit command"
```

### `system_shutdown` & `system_restart`

**Risks:**
- Unexpected system unavailability
- Unsaved work loss
- User annoyance

**Controls:**
1. Two-step confirmation
2. Show warning clearly
3. 60 second timeout before executing
4. Allow cancellation during countdown

**Example:**
```
BOW: "Restart computer in 60 seconds?

⚠️  SAVE YOUR WORK - Computer will restart
⚠️  Unsaved files will be lost

[RESTART] [CANCEL]
```

## Dangerous Commands List

Commands that are **BLOCKED** in V1:

### System Level
- `format C:` - Format drive
- `cipher /w` - Wipe free space
- `diskpart` - Partition management
- `bcdedit` - Boot configuration
- `net stop` - Stop system services
- `sc delete` - Delete services

### File System
- `deltree` - Delete entire directory
- `rm -rf /` - Unix equivalent
- `del system32` - Delete system folder
- `attrib -s -h` - Unhide system files

### Registry (Windows)
- `reg delete HKLM` - Delete registry hive
- `reg import malware.reg` - Import registry

### Security
- `netsh advfirewall set` - Modify firewall
- `auditpol` - Modify audit policy
- `gpupdate` - Force group policy

### Package Management
- `pip uninstall python` - Uninstall interpreter
- `apt-get remove` - Remove package manager

## Emergency Override

For legitimate administrative use:

1. **Physically press reset button** (if system supports)
2. **Hardware kill switch** (future feature)
3. **Administrative override** (requires multiple approvals)

**In code:**
```typescript
// Admin-only override (with approval logging)
const override = await requireAdminApproval(
  tool,
  arguments,
  "SAFETY_OVERRIDE"
);

if (override) {
  return execute(tool, arguments, {
    skipSafetyChecks: true,
    recordedReason: "Admin override approved by: [admins]"
  });
}
```

## Safety Policy Testing

Unit tests for safety:

```typescript
describe("Safety System", () => {
  test("SAFE tools execute without confirmation", async () => {
    const result = await execute("screenshot", {});
    expect(result.success).toBe(true);
    expect(result.requiresConfirmation).toBeUndefined();
  });

  test("CONFIRM tools require user approval", async () => {
    const result = await execute("send_message", {
      recipient: "alice",
      message: "hello"
    });
    expect(result.requiresConfirmation).toBe(true);
    expect(result.status).toBe("pending_confirmation");
  });

  test("BLOCKED tools are always denied", async () => {
    const result = await execute("system_format_drive", {
      drive: "C:"
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("BLOCKED");
  });

  test("Invalid arguments rejected", async () => {
    const result = await execute("send_message", {
      recipient: 123, // Wrong type
      message: "hello"
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("validation");
  });
});
```

## Future Enhancements

### V2: Role-Based Access Control

```typescript
interface Role {
  name: "user" | "power_user" | "admin";
  tools: Tool[];
  requiresConfirmation: boolean;
}
```

### V3: Intent Analysis

Before executing, AI analyzes:
- User intent
- Likely consequences
- Collateral damage potential
- Recommended alternatives

### V4: Learning System

- Track user preferences
- Learn safe patterns
- Reduce confirmation fatigue
- Increase automation gradually
