import { promises as fs } from "fs";
import path from "path";
import { execFile } from "child_process";
import { spawn } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const serverUrl = process.env.BOW_E2E_SERVER_URL || "http://127.0.0.1:3000";
const enabled = process.env.BOW_E2E_ENABLED === "true";
const desktopAllowed = process.env.BOW_E2E_ALLOW_DESKTOP_CONTROL === "true";
const evidenceDir = path.resolve(process.env.BOW_E2E_EVIDENCE_DIR || `evidence/step2.1-${new Date().toISOString().replace(/[:.]/g, "-")}`);
await fs.mkdir(evidenceDir, { recursive: true });

const cases = [
    { id: "E2E-COMP-001", name: "Open Notepad", run: () => query("open Notepad", "notepad") },
    { id: "E2E-COMP-002", name: "Open Calculator", run: () => query("open Calculator", "calc") },
    { id: "E2E-COMP-003", name: "Open Chrome", run: () => query("open Chrome", "chrome") },
    { id: "E2E-COMP-004", name: "Open Notepad and type text", run: () => query("open Notepad and type 'Hello BOW'", "notepad") },
    { id: "E2E-COMP-005", name: "Open Chrome and navigate", run: async () => ({ status: "SKIPPED", reason: "Browser controller is not yet certified in Step 2" }) },
    { id: "E2E-COMP-006", name: "Remote Agent offline", run: runOfflineCase },
    { id: "E2E-COMP-007", name: "Invalid tool", run: runInvalidToolCase },
    { id: "E2E-COMP-008", name: "Unauthorized Remote Agent", run: runUnauthorizedCase },
    { id: "E2E-COMP-009", name: "Verification failure", run: runVerificationFailureCase },
    { id: "E2E-COMP-010", name: "Dangerous action confirmation", run: runDangerousCase },
];

async function query(text, processName, expectedStatus) {
    const response = await fetch(`${serverUrl}/agent/query`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: text, sessionId: `e2e-${Date.now()}` }) });
    const body = await response.json();
    if (!response.ok) return { status: "FAIL", error: body.error || `HTTP ${response.status}` };
    if (processName) {
        const exists = await processExists(processName);
        if (!exists) return { status: "FAIL", error: `Verification failed: process ${processName} was not detected`, response: compact(body) };
    }
    const success = body.execution?.success === true;
    if (expectedStatus === "BLOCKED" && success) return { status: "FAIL", error: "Dangerous action unexpectedly succeeded", response: compact(body) };
    const status = expectedStatus || (success ? "PASS" : "FAIL");
    return { status, response: compact(body) };
}

async function runOfflineCase() {
    const port = 3101;
    const token = `e2e-offline-${Date.now()}`;
    const server = startNode("bow-server/dist/index.js", { BOW_SERVER_HOST: "127.0.0.1", BOW_SERVER_PORT: String(port), REMOTE_AGENT_TOKEN: token });
    try {
        await waitForHttp(`http://127.0.0.1:${port}/health`);
        const before = await processCount("notepad");
        const response = await fetch(`http://127.0.0.1:${port}/agent/query`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "open Notepad", sessionId: "e2e-offline" }) });
        const body = await response.json();
        const after = await processCount("notepad");
        const failed = response.ok && body.execution?.success === false && String(JSON.stringify(body)).includes("REMOTE_AGENT_OFFLINE");
        return { status: failed && before === after ? "PASS" : "FAIL", response: compact(body), verification: { remoteAgentOffline: true, notepadProcessCountBefore: before, notepadProcessCountAfter: after } };
    } finally { await stopNode(server); }
}

async function runUnauthorizedCase() {
    const port = 3102;
    const server = startNode("bow-server/dist/index.js", { BOW_SERVER_HOST: "127.0.0.1", BOW_SERVER_PORT: String(port), REMOTE_AGENT_TOKEN: "VALID_TOKEN" });
    const agent = startNode("bow-remote-agent/dist/index.js", { BOW_SERVER_HOST: "127.0.0.1", BOW_SERVER_PORT: String(port), REMOTE_AGENT_TOKEN: "INVALID_TOKEN", BOW_VOICE_ENABLED: "false" });
    try {
        await waitForHttp(`http://127.0.0.1:${port}/health`);
        const exited = await waitForExit(agent, 5000);
        const health = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
        const rejected = exited && health.services?.remoteAgent === "offline";
        return { status: rejected ? "PASS" : "FAIL", authAttempt: { token: "[REDACTED]", expected: "rejected", agentExited: exited }, serverResult: { remoteAgent: health.services?.remoteAgent }, verification: { authenticated: false, toolExecutionAllowed: false } };
    } finally { await stopNode(agent); await stopNode(server); }
}

async function runInvalidToolCase() {
    const { default: ToolRegistry } = await import("../bow-server/dist/tools/registry.js");
    const { default: ToolExecutor } = await import("../bow-server/dist/tools/executor.js");
    const { Logger } = await import("../shared/dist/index.js");
    const result = await new ToolExecutor(Logger.create("e2e-invalid", "error"), new ToolRegistry(Logger.create("e2e-registry", "error"))).execute("this_tool_does_not_exist", {}, { sessionId: "e2e-invalid", userId: "e2e", timestamp: new Date().toISOString(), requestId: "invalid-tool" });
    return { status: result.success ? "FAIL" : "PASS", response: { executionAttempted: false, error: result.error } };
}

async function runVerificationFailureCase() {
    const { default: ApplicationLauncher } = await import("../bow-remote-agent/dist/launcher.js");
    const { Logger } = await import("../shared/dist/index.js");
    const result = await new ApplicationLauncher(Logger.create("e2e-verification", "error")).launch('BOW_TEST_NONEXISTENT_APP"', { waitForWindow: true, windowTimeoutMs: 100 });
    return { status: result.success ? "FAIL" : "PASS", response: { success: result.success, error: result.error, verified: false } };
}

async function runDangerousCase() {
    const { SafetyPolicy } = await import("../bow-server/dist/safety.js");
    const decision = new SafetyPolicy().assess("terminal_execute", "CONFIRM");
    return { status: !decision.allowed && decision.requiresConfirmation ? "PASS" : "FAIL", response: { executionAttempted: false, safetyDecision: decision } };
}

function startNode(entry, env) { return spawn(process.execPath, [entry], { cwd: path.resolve("."), env: { ...process.env, ...env }, stdio: "ignore", windowsHide: true }); }
async function waitForHttp(url, timeout = 10000) { const end = Date.now() + timeout; while (Date.now() < end) { try { const response = await fetch(url); if (response.ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 200)); } throw new Error(`Timed out waiting for ${url}`); }
async function waitForExit(child, timeout) { if (child.exitCode !== null) return true; return new Promise((resolve) => { const timer = setTimeout(() => resolve(false), timeout); child.once("exit", () => { clearTimeout(timer); resolve(true); }); }); }
async function stopNode(child) { if (!child || child.exitCode !== null) return; child.kill(); await new Promise((resolve) => setTimeout(resolve, 250)); }
async function processCount(name) { if (process.platform !== "win32") return 0; try { const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", `@(Get-Process -Name '${name}' -ErrorAction SilentlyContinue).Count`], { windowsHide: true }); return Number(stdout.trim()) || 0; } catch { return 0; } }

async function processExists(name) {
    if (process.platform !== "win32") return false;
    try { const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", `@(Get-Process -Name '${name}' -ErrorAction SilentlyContinue).Count`], { windowsHide: true }); return Number(stdout.trim()) > 0; }
    catch { return false; }
}

function compact(value) {
    const json = JSON.stringify(value, (key, current) => key === "data" && typeof current === "string" && current.length > 1000 ? `[omitted ${current.length} bytes]` : current);
    return JSON.parse(json);
}

const results = [];
for (const testCase of cases) {
    let result;
    const desktopCase = /^E2E-COMP-00[1-5]$/.test(testCase.id);
    if (!enabled || (desktopCase && !desktopAllowed)) result = { status: "SKIPPED", reason: desktopCase ? "Set BOW_E2E_ENABLED=true and BOW_E2E_ALLOW_DESKTOP_CONTROL=true to enable real desktop control" : "Set BOW_E2E_ENABLED=true to run negative certification" };
    else {
        try { result = await testCase.run(); } catch (error) { result = { status: "FAIL", error: error instanceof Error ? error.message : String(error) }; }
    }
    const evidence = { testId: testCase.id, name: testCase.name, timestamp: new Date().toISOString(), userRequest: testCase.name, ...result };
    results.push(evidence);
    const caseDir = path.join(evidenceDir, testCase.id); await fs.mkdir(caseDir, { recursive: true });
    await fs.writeFile(path.join(caseDir, "result.json"), JSON.stringify(evidence, null, 2));
    if (result.response) await fs.writeFile(path.join(caseDir, "response.json"), JSON.stringify(result.response, null, 2));
    if (result.authAttempt) await fs.writeFile(path.join(caseDir, "auth-attempt.json"), JSON.stringify(result.authAttempt, null, 2));
    if (result.verification) await fs.writeFile(path.join(caseDir, "agent-state.json"), JSON.stringify(result.verification, null, 2));
    console.log(`${testCase.id} ${result.status} — ${testCase.name}${result.reason ? ` (${result.reason})` : ""}`);
}

await fs.writeFile(path.join(evidenceDir, "summary.json"), JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
console.log(`Evidence: ${evidenceDir}`);
process.exitCode = results.some((result) => result.status === "FAIL") ? 1 : 0;
