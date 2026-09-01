export interface MemoryRecord {
    id: string;
    scope: "conversation" | "preference" | "task" | "tool";
    key: string;
    value: unknown;
    sessionId?: string;
    createdAt: string;
    updatedAt: string;
}

export interface MemoryProvider {
    get(scope: MemoryRecord["scope"], key: string, sessionId?: string): Promise<MemoryRecord | undefined>;
    set(record: Omit<MemoryRecord, "id" | "createdAt" | "updatedAt">): Promise<MemoryRecord>;
    list(scope?: MemoryRecord["scope"], sessionId?: string): Promise<MemoryRecord[]>;
    delete(scope: MemoryRecord["scope"], key: string, sessionId?: string): Promise<boolean>;
}
