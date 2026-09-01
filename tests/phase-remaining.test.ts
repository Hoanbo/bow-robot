import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { Logger } from "@bow/shared";
import { JsonMemoryProvider } from "@bow/server/memory.js";
import { SafetyPolicy } from "@bow/server/safety.js";
import ToolRegistry from "@bow/server/tools/registry.js";
import Planner from "@bow/server/agent/planner.js";
import ToolExecutor from "@bow/server/tools/executor.js";
import ApplicationLauncher from "@bow/remote-agent/launcher.js";

const logger = Logger.create("phase-remaining-test", "error");

test("memory persists records and rejects secret-like keys", async () => {
    const file = path.join(os.tmpdir(), `bow-memory-${Date.now()}.json`);
    const memory = new JsonMemoryProvider(logger, file, 10);
    const record = await memory.set({ scope: "preference", key: "language", value: "vi", sessionId: "test" });
    assert.equal(record.value, "vi");
    assert.equal((await memory.get("preference", "language", "test"))?.value, "vi");
    await assert.rejects(() => memory.set({ scope: "preference", key: "api_key", value: "secret" }));
    await fs.rm(file, { force: true });
});

test("safety blocks dangerous tools until confirmation", () => {
    const safety = new SafetyPolicy();
    assert.equal(safety.assess("terminal_execute", "CONFIRM").allowed, false);
    assert.equal(safety.assess("terminal_execute", "CONFIRM", true).allowed, true);
    assert.equal(safety.assess("system_format_drive", "BLOCKED").allowed, false);
});

test("planner selects real application tool for Notepad", () => {
    const plan = new Planner(logger, new ToolRegistry(logger)).plan("BOW, open Notepad");
    assert.equal(plan.steps[0]?.toolName, "open_application");
    assert.equal(plan.steps[0]?.input.name, "notepad");
});

test("unknown tool fails before remote execution", async () => {
    const executor = new ToolExecutor(logger, new ToolRegistry(logger));
    const result = await executor.execute("this_tool_does_not_exist", {}, { sessionId: "negative", userId: "test", timestamp: new Date().toISOString(), requestId: "invalid-tool" });
    assert.equal(result.success, false);
    assert.match(result.error || "", /Unknown tool/);
});

test("application input validation fails safely", async () => {
    const launcher = new ApplicationLauncher(logger);
    const result = await launcher.launch('bad"application', { waitForWindow: true, windowTimeoutMs: 100 });
    assert.equal(result.success, false);
});

test("multi-step desktop plan focuses before typing", () => {
    const plan = new Planner(logger, new ToolRegistry(logger)).plan("open Notepad and type 'Hello BOW'");
    assert.deepEqual(plan.steps.map((step) => step.toolName), ["open_application", "focus_window", "keyboard_type"]);
    assert.deepEqual(plan.steps.map((step) => step.id), ["step-1", "step-2", "step-3"]);
    assert.deepEqual(plan.steps[2].dependencies, ["step-2"]);
});
