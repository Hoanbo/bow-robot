# BOW V1.0 — STEP 2 COMPUTER CONTROL REPORT

**Date:** 2026-09-01  
**Scope:** Real Windows Computer Control + E2E Certification  
**Repository:** `C:\Web\Agentofbow`

## Overall Status

**PARTIAL / NOT CERTIFIED**

The execution path is implemented and the Windows controller code is compiled. Real desktop E2E was not marked PASS because it was intentionally not enabled during this run. The E2E harness reported all ten cases as `SKIPPED`.

## Architecture Status

```text
HTTP /agent/query
  → AI Agent / Planner
  → ToolExecutor
  → authenticated WebSocket
  → Remote Agent
  → Windows controller
  → result / verification
```

The Server sends tool commands to the authenticated Remote Agent. The Remote Agent dispatches commands to the local Windows controllers and returns the result. Offline agents and invalid authentication do not produce a successful tool result.

## Build Status

```text
npm run build  PASS
```

The root build completed for Server, Remote Agent, Shared, Simulator and Tests.

## Unit Tests

```text
npm test       PASS — 3/3
```

Covered:

- Memory persistence and secret-key rejection.
- Safety confirmation and blocked-tool policy.
- Planner selection for `open Notepad`.

## Integration / Smoke Tests

- Server `/health`: PASS (`status: ok`).
- Server `/tools`: PASS.
- Simulator WebSocket on port `3002`: PASS.
- Simulator state message: PASS.
- `npm run validate:local`: PASS when the Server is running.

## Real Windows E2E

Command:

```powershell
npm run e2e:windows
```

Safety gates:

```env
BOW_E2E_ENABLED=true
BOW_E2E_ALLOW_DESKTOP_CONTROL=true
```

Without both flags, every desktop case is `SKIPPED`. During this certification run, the flags were not enabled:

| ID | Case | Result |
|---|---|---|
| E2E-COMP-001 | Open Notepad | SKIPPED |
| E2E-COMP-002 | Open Calculator | SKIPPED |
| E2E-COMP-003 | Open Chrome | SKIPPED |
| E2E-COMP-004 | Open Notepad + Type Text | SKIPPED |
| E2E-COMP-005 | Open Chrome + Navigate | SKIPPED |
| E2E-COMP-006 | Remote Agent Offline | SKIPPED |
| E2E-COMP-007 | Invalid Tool | SKIPPED |
| E2E-COMP-008 | Unauthorized Agent | SKIPPED |
| E2E-COMP-009 | Verification Failure | SKIPPED |
| E2E-COMP-010 | Dangerous Action Confirmation | SKIPPED |

This is not a real Windows E2E PASS. A real run must be performed on the target Windows desktop with the Server and Remote Agent running, and the results must be reviewed before changing the status.

## Computer Control Coverage

Implemented for Windows:

- Application launch through `cmd.exe start` with aliases for Notepad, Calculator, Chrome, Explorer, Code and Terminal.
- Process/window verification with `tasklist`, `Get-Process` and wait timeout.
- Window focus with `WScript.Shell.AppActivate`.
- Visible window listing with PowerShell process metadata.
- Mouse move, left/right/middle click, double click and scroll through `user32.dll`.
- Coordinate validation against primary screen bounds.
- Keyboard typing and key mapping through `WScript.Shell.SendKeys`.
- Input length and key validation.
- PNG screenshot capture through `System.Drawing`.
- Temporary screenshot cleanup after capture.

## Browser Control Coverage

**NOT CERTIFIED.** The BrowserController still contains placeholder methods for Playwright/browser navigation. E2E-COMP-005 is therefore reported as `SKIPPED`, not PASS.

## Safety Status

- Blocked tools are rejected.
- Confirmation-level tools are rejected without explicit confirmation.
- Terminal remains confirmation-protected.
- E2E desktop control is opt-in through two environment flags.
- Test evidence omits large screenshot payloads.

## Security Status

- Remote Agent authentication uses `REMOTE_AGENT_TOKEN` with timing-safe comparison.
- The Remote Agent should be reachable only from localhost/LAN firewall scope.
- Secrets are not intended to be written to memory or logs.
- Do not expose port 3000 directly to the public Internet.

## Evidence Location

The latest gated E2E evidence is under:

```text
evidence/step2-2026-08-31T19-37-33-439Z/
```

The runner is located at:

```text
scripts/run-windows-e2e.mjs
```

## How to Perform the Real Run

1. Close or save any active desktop applications where typing could be disruptive.
2. Start the Server, Remote Agent and Simulator in separate terminals.
3. Set the two E2E flags in the Remote Agent environment.
4. Run `npm run e2e:windows` from the repository root.
5. Review each JSON file in the generated evidence directory.
6. Manually confirm Notepad/Calculator/Chrome behavior and reset the E2E flags afterward.

## Known Limitations

- This report does not claim Notepad, Calculator or Chrome real E2E PASS because that requires an interactive Windows desktop run.
- `SendKeys` targets the active window; focus verification is required before typing.
- Multi-monitor coordinates currently use the primary screen bounds.
- Browser automation remains not implemented.
- OCR, local LLM, STT/TTS and robot hardware are outside Step 2.

## Next Gate

Run the gated Windows E2E suite on the actual target PC. Step 2 can be marked PASS only when the required cases produce real `PASS` results and no case is represented as `MOCK_PASS`, `FAKE_PASS` or `SIMULATED_PASS`.
