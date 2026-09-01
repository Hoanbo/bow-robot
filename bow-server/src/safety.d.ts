import { PermissionLevel } from "@bow/shared";
export interface SafetyDecision {
    allowed: boolean;
    requiresConfirmation: boolean;
    reason?: string;
    level: PermissionLevel;
}
export declare class SafetyPolicy {
    assess(tool: string, level: PermissionLevel, confirmed?: boolean): SafetyDecision;
}
//# sourceMappingURL=safety.d.ts.map