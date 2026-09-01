import { MemoryProvider, MemoryRecord, generateRequestId, getCurrentTimestamp, Logger } from "@bow/shared";
import { promises as fs } from "fs";
import path from "path";

const SECRET_KEY = /(password|passwd|secret|token|api[_-]?key|cookie|authorization)/i;

export class JsonMemoryProvider implements MemoryProvider {
    private records = new Map<string, MemoryRecord>();
    private loaded = false;
    constructor(private readonly logger: Logger, private readonly filePath: string, private readonly maxSize: number) {}

    async get(scope: MemoryRecord["scope"], key: string, sessionId?: string): Promise<MemoryRecord | undefined> { await this.load(); return this.records.get(this.id(scope, key, sessionId)); }
    async set(input: Omit<MemoryRecord, "id" | "createdAt" | "updatedAt">): Promise<MemoryRecord> {
        await this.load();
        if (SECRET_KEY.test(input.key)) throw new Error("Secret-like memory keys are not allowed");
        const now = getCurrentTimestamp(); const id = this.id(input.scope, input.key, input.sessionId);
        const record = { ...input, id, createdAt: this.records.get(id)?.createdAt || now, updatedAt: now };
        this.records.set(id, record); while (this.records.size > this.maxSize) this.records.delete(this.records.keys().next().value!);
        await this.save(); return record;
    }
    async list(scope?: MemoryRecord["scope"], sessionId?: string): Promise<MemoryRecord[]> { await this.load(); return [...this.records.values()].filter((r) => (!scope || r.scope === scope) && (!sessionId || r.sessionId === sessionId)); }
    async delete(scope: MemoryRecord["scope"], key: string, sessionId?: string): Promise<boolean> { await this.load(); const deleted = this.records.delete(this.id(scope, key, sessionId)); if (deleted) await this.save(); return deleted; }
    private id(scope: string, key: string, sessionId?: string): string { return `${scope}:${sessionId || "global"}:${key}`; }
    private async load(): Promise<void> { if (this.loaded) return; this.loaded = true; try { const data = JSON.parse(await fs.readFile(this.filePath, "utf8")) as MemoryRecord[]; for (const record of data) this.records.set(record.id, record); } catch { this.logger.debug("Starting with empty memory store"); } }
    private async save(): Promise<void> { await fs.mkdir(path.dirname(this.filePath), { recursive: true }); await fs.writeFile(this.filePath, JSON.stringify([...this.records.values()], null, 2), "utf8"); }
}
