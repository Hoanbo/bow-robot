# BOW V1.0 — Two-PC LAN Setup

This guide separates the system into two Windows PCs:

```text
PC A (Xeon)       BOW Server, Planner, Memory and Safety
PC B (main PC)    Remote Agent and real desktop control
```

The Remote Agent opens an outbound authenticated WebSocket connection to PC A.
It does not expose a public desktop-control server.

## 1. Prerequisites

Install Node.js 18 or newer on both PCs. Clone the repository on both PCs and
run from the repository root:

```powershell
npm install
npm run build
```

## 2. Configure PC A — Server

Create `.env` from `.env.example`:

```env
NODE_ENV=production
BOW_SERVER_HOST=0.0.0.0
BOW_SERVER_PORT=3000
REMOTE_AGENT_TOKEN=generate-a-long-random-shared-secret
SERVER_REQUIRE_AUTH=true
```

Use the same token on PC B. Never commit the real token or print it in logs.
Find PC A's LAN address with:

```powershell
ipconfig
```

Use the IPv4 address of the trusted LAN adapter, for example `192.168.1.10`.

Start the server:

```powershell
npm run server
```

## 3. Configure PC B — Remote Agent

Create `.env` from `.env.example` and point the agent to PC A:

```env
BOW_SERVER_HOST=192.168.1.10
BOW_SERVER_PORT=3000
REMOTE_AGENT_TOKEN=generate-a-long-random-shared-secret
BOW_VOICE_ENABLED=false
```

Start only the Remote Agent for real LAN certification:

```powershell
npm run agent
```

Do not start the Simulator as a replacement for the real agent.

## 4. Windows Firewall on PC A

Allow inbound TCP port 3000 only from the trusted private LAN. Example (run
PowerShell as Administrator and adjust the subnet):

```powershell
New-NetFirewallRule -DisplayName "BOW Server LAN 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -RemoteAddress 192.168.1.0/24 -Action Allow -Profile Private
```

Do not open the Remote Agent port, debug ports or Internet port forwarding.

## 5. Connectivity checks

On PC B:

```powershell
Test-NetConnection 192.168.1.10 -Port 3000
npm run network:diagnose
```

Expected output includes `TCP: PASS`, `WebSocket: PASS`,
`Authentication: PASS` and `Agent connection state: READY`.

On either PC A or PC B, verify:

```powershell
Invoke-RestMethod http://192.168.1.10:3000/health
```

The server reports `remoteAgent: connected` only after successful
authentication. When the agent is unavailable, the overall health is
`degraded` and the agent is `offline`.

## 6. Real LAN command test

From PC A, send a request to the server:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3000/agent/query -ContentType "application/json" -Body '{"query":"open Notepad"}'
```

The Notepad window must open on PC B and the response must contain successful
execution and verification. Repeat with Calculator and a typing scenario.

## 7. Diagnostics and troubleshooting

- `TCP FAIL`: check PC A's LAN IP, private network profile and firewall rule.
- `WebSocket FAIL`: confirm the server is running and port 3000 is reachable.
- `Authentication FAIL`: compare the shared tokens without logging them.
- `remoteAgent: offline`: start the agent on PC B and inspect its state logs.
- After a server restart, the agent should transition through reconnecting and
  return to `READY` automatically with bounded exponential backoff.
- If the agent is intentionally stopped, the server must report degraded/offline
  and must not claim a desktop command succeeded.

## 8. LAN E2E certification

Run the dedicated suite only on the real two-PC setup, with the explicit gate:

```powershell
$env:BOW_LAN_E2E_ENABLED="true"
npm run e2e:lan
```

Do not mark Step 3 certified from localhost, Simulator output or mock output.
Record the generated evidence directory and certify only after the real PC B
desktop actions have been manually reviewed.
