# BOW V1.0 — STEP 2.1 CERTIFICATION REPORT

**Date:** 2026-09-01  
**Scope:** Computer Control Reliability & Security Certification  
**Overall Status:** **PASS / CERTIFIED**

Step 2.1 is certified for the Windows computer-control scope. The real
desktop regression run and the controlled negative run completed successfully.
This certification does not claim that the entire BOW V1 product is complete.

## Architecture

```text
HTTP /agent/query
  → AI Agent / Planner
  → Tool Executor
  → authenticated WebSocket
  → Remote Agent
  → Windows controller
  → real desktop result / verification
```

## Build and automated regression

```text
npm run build          PASS
npm test               PASS — 6/6
npm run validate:local PASS
```

The unit and negative tests cover memory protection, safety confirmation,
planner selection, unknown-tool rejection, application validation and
multi-step ordering.

## E2E certification matrix

| Case | Result | Scope |
|---|---|---|
| E2E-COMP-001 Open Notepad | PASS | Real Windows desktop |
| E2E-COMP-002 Open Calculator | PASS | Real Windows desktop |
| E2E-COMP-003 Open Chrome | PASS | Real Windows desktop |
| E2E-COMP-004 Open Notepad + type text | PASS | Real Windows desktop |
| E2E-COMP-005 Browser navigation | SKIPPED | Browser Controller pending |
| E2E-COMP-006 Remote Agent offline | PASS | Isolated negative test |
| E2E-COMP-007 Invalid tool | PASS | Rejected before remote execution |
| E2E-COMP-008 Unauthorized Agent | PASS | Invalid token rejected |
| E2E-COMP-009 Verification failure | PASS | Invalid application rejected safely |
| E2E-COMP-010 Dangerous action confirmation | PASS | Blocked without confirmation |

E2E-COMP-007 intentionally produces an error because the test verifies that
an unknown tool cannot execute. The error is expected negative-test evidence,
not a product defect.

## Evidence

The certified run evidence is stored at:

```text
C:\Web\Agentofbow\evidence\step2.1-2026-08-31T19-53-57-136Z
```

The runner is `scripts/run-windows-e2e.mjs`. It does not store tokens, API
keys, cookies or authorization headers.

## Certified components

- Windows application launch and process verification.
- Keyboard typing, mouse validation and screenshot handling.
- Authenticated Remote Agent communication.
- Offline-agent handling and invalid-token rejection.
- Unknown-tool rejection before remote execution.
- Verification-failure handling and safety confirmation policy.
- E2E evidence generation and result classification.

## Pending components

- Browser Controller and Chrome navigation (E2E-COMP-005).
- Vision/OCR.
- Local LLM provider validation.
- STT/TTS and microphone/speaker integration.
- ESP32 and physical robot hardware.

## Security conclusion

Remote Agent authentication uses timing-safe token comparison. Commands and
application names are validated before execution. Dangerous and blocked tools
cannot run without the required policy decision. Desktop E2E is opt-in via
explicit environment flags, and the agent should remain restricted to
localhost/LAN firewall scope.

## Freeze decision

Step 2.1 computer-control and security behavior is frozen as certified. Do
not change this scope without a new certification run. The next development
scope is Step 3 / Two-PC LAN deployment; browser, vision, speech and hardware
remain separate future work.

**BOW V1.0 STEP 2.1 COMPUTER CONTROL RELIABILITY & SECURITY STATUS: PASS / CERTIFIED**
