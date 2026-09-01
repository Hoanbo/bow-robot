import { PermissionLevel } from "@bow/shared";

export interface SafetyDecision { allowed: boolean; requiresConfirmation: boolean; reason?: string; level: PermissionLevel; }

export class SafetyPolicy {
    assess(tool: string, level: PermissionLevel, confirmed = false): SafetyDecision {
        if (level === "BLOCKED") return { allowed: false, requiresConfirmation: false, level, reason: `Tool ${tool} is blocked by policy` };
        if (level === "CONFIRM" && !confirmed) return { allowed: false, requiresConfirmation: true, level, reason: "User confirmation is required" };
        return { allowed: true, requiresConfirmation: false, level };
    }
}
