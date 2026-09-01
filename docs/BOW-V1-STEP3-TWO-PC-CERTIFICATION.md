# BOW V1.0 — STEP 3 TWO-PC LAN CERTIFICATION

**Date:** 2026-09-01  
**Overall Status:** **PARTIAL / NOT CERTIFIED**

## Scope

Step 3 productionizes the separated deployment:

```text
PC A (Xeon) BOW Server
        │ trusted LAN
        ▼
Authenticated outbound WebSocket
        │
PC B (main PC) Remote Agent → Windows Controller → desktop
```

The Simulator is not used for LAN certification.

## Implemented

- Server remains a separate process from Remote Agent.
- Server binds to `BOW_SERVER_HOST` and `BOW_SERVER_PORT`, including LAN
  binding with `BOW_SERVER_HOST=0.0.0.0`.
- Remote Agent connects outbound to the configured server address.
- Authentication remains timing-safe and token values are never logged.
- Remote Agent exposes explicit states: `DISCONNECTED`, `CONNECTING`,
  `AUTHENTICATING`, `READY`, `ERROR` and `RECONNECTING`.
- Heartbeat requests have timeouts and stale sockets are terminated.
- Reconnect uses bounded exponential backoff from 1 second to 30 seconds.
- `/health` reports `degraded` and `remoteAgent: offline` when no authenticated
  Remote Agent is connected.
- Added `npm run network:diagnose` for IP, TCP, WebSocket and authentication
  diagnostics without printing the token.
- Added gated `npm run e2e:lan` for real two-PC testing. It never produces fake
  PASS results for manual failure/reconnect scenarios.
- Added Windows Firewall and two-PC setup documentation.

## Regression checks

```text
npm run build          PASS
npm test               PASS — 6/6
npm run validate:local PASS
```

The expected unknown-tool error appears in test logs because the negative test
proves that the command is rejected before remote execution; the test suite
still passes 6/6.

## Two-PC E2E status

| Case | Result | Evidence |
|---|---|---|
| E2E-LAN-001 Server + authenticated agent ready | NOT RUN | Requires PC A and PC B |
| E2E-LAN-002 Open Notepad on PC B | NOT RUN | Requires real LAN |
| E2E-LAN-003 Open Calculator on PC B | NOT RUN | Requires real LAN |
| E2E-LAN-004 Open Notepad and type | NOT RUN | Requires real LAN |
| E2E-LAN-005 Agent offline | NOT RUN | Controlled process test required |
| E2E-LAN-006 Agent restart/reconnect | NOT RUN | Controlled process test required |
| E2E-LAN-007 Network interruption | NOT RUN | Must be controlled safely |
| E2E-LAN-008 Invalid token | NOT RUN | Two-PC authentication test required |
| E2E-LAN-009 Server restart/reconnect | NOT RUN | Controlled process test required |
| E2E-LAN-010 Invalid tool | NOT RUN | Real PC A/PC B test required |

Step 3 is intentionally not marked certified: this workspace run validated
the implementation locally, but did not execute the required real Xeon-to-main
PC LAN scenarios. No `MOCK_PASS`, `FAKE_PASS` or `SIMULATED_PASS` is claimed.

## Configuration

See [BOW-V1-TWO-PC-SETUP.md](BOW-V1-TWO-PC-SETUP.md). The central settings are:

```env
BOW_SERVER_HOST=0.0.0.0       # PC A server bind
BOW_SERVER_PORT=3000
REMOTE_AGENT_TOKEN=<shared-secret>

# PC B Remote Agent process:
BOW_SERVER_HOST=<PC-A-LAN-IP>
BOW_SERVER_PORT=3000
REMOTE_AGENT_TOKEN=<same-shared-secret>
```

## Files created or changed

- `scripts/network-diagnose.mjs`
- `scripts/run-lan-e2e.mjs`
- `docs/BOW-V1-TWO-PC-SETUP.md`
- `bow-remote-agent/src/connection.ts`
- `bow-remote-agent/src/index.ts`
- `bow-server/src/server.ts`
- `.env.example`
- `package.json`

## Security result

The LAN layer does not bypass Planner, ToolExecutor, Safety or input
validation. Only the authenticated WebSocket carries computer-control commands.
Expose only TCP 3000 to the trusted private LAN; do not expose the Remote Agent
or use Internet port forwarding.

## Known limitations and next gate

Real two-PC execution, reconnect, invalid-token and controlled network
interruption evidence are still required. Run the setup on PC A and PC B,
then execute:

```powershell
$env:BOW_LAN_E2E_ENABLED="true"
npm run e2e:lan
```

Update this report with the generated evidence directory only after manually
reviewing the real desktop results. Step 3 can become `PASS / CERTIFIED` only
when the required real LAN cases succeed or are safely blocked as specified.
