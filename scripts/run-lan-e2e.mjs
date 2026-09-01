/**
 * Two-PC LAN E2E harness. Run this only with a real Server on PC A and a real
 * Remote Agent on PC B. It never starts a Simulator and is gated explicitly.
 */
import fs from "node:fs/promises";
import path from "node:path";

if (process.env.BOW_LAN_E2E_ENABLED !== "true") {
    console.error("LAN E2E is disabled. Set BOW_LAN_E2E_ENABLED=true on the real two-PC setup.");
    process.exitCode = 2;
    process.exit();
}

const host = process.env.BOW_E2E_SERVER_HOST || "127.0.0.1";
const port = Number(process.env.BOW_SERVER_PORT || 3000);
const baseUrl = `http://${host}:${port}`;
const root = path.resolve("evidence", `step3-lan-${new Date().toISOString().replace(/[:.]/g, "-")}`);
await fs.mkdir(root, { recursive: true });

async function health() {
    const response = await fetch(`${baseUrl}/health`);
    return { httpStatus: response.status, body: await response.json() };
}

async function query(query) {
    const response = await fetch(`${baseUrl}/agent/query`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, sessionId: `lan-e2e-${Date.now()}` }),
    });
    return { httpStatus: response.status, body: await response.json() };
}

function succeeded(result) {
    return result.httpStatus === 200 && result.body?.execution?.success === true;
}

const results = [];
try {
    const initial = await health();
    const ready = initial.httpStatus === 200 && initial.body?.status === "ok" && initial.body?.services?.remoteAgent === "connected";
    results.push({ id: "E2E-LAN-001", status: ready ? "PASS" : "FAIL", description: "Server and authenticated Remote Agent are ready", health: initial });

    if (ready) {
        const cases = [
            ["E2E-LAN-002", "open Notepad"],
            ["E2E-LAN-003", "open Calculator"],
            ["E2E-LAN-004", "open Notepad and type Hello from BOW"],
        ];
        for (const [id, request] of cases) {
            const result = await query(request);
            results.push({ id, status: succeeded(result) ? "PASS" : "FAIL", request, response: result });
        }
    } else {
        for (const id of ["E2E-LAN-002", "E2E-LAN-003", "E2E-LAN-004"]) results.push({ id, status: "BLOCKED", reason: "Authenticated Remote Agent is not READY" });
    }
} catch (error) {
    results.push({ id: "E2E-LAN-001", status: "FAIL", error: String(error) });
}

// These cases require intentionally stopping/restarting a real process or
// network adapter. The harness records them as manual gates, never as PASS.
for (const id of ["E2E-LAN-005", "E2E-LAN-006", "E2E-LAN-007", "E2E-LAN-008", "E2E-LAN-009", "E2E-LAN-010"]) {
    results.push({ id, status: "MANUAL_REQUIRED", reason: "Run the controlled two-PC failure/reconnect scenario; no fake PASS is produced" });
}

await fs.writeFile(path.join(root, "summary.json"), JSON.stringify({ generatedAt: new Date().toISOString(), server: `${host}:${port}`, results }, null, 2));
for (const result of results) await fs.writeFile(path.join(root, `${result.id}.json`), JSON.stringify(result, null, 2));
console.log(`LAN E2E evidence: ${root}`);
for (const result of results) console.log(`${result.id}: ${result.status}`);
if (results.some((result) => result.status === "FAIL")) process.exitCode = 1;
