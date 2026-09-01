export class SafetyPolicy {
    assess(tool, level, confirmed = false) {
        if (level === "BLOCKED")
            return { allowed: false, requiresConfirmation: false, level, reason: `Tool ${tool} is blocked by policy` };
        if (level === "CONFIRM" && !confirmed)
            return { allowed: false, requiresConfirmation: true, level, reason: "User confirmation is required" };
        return { allowed: true, requiresConfirmation: false, level };
    }
}
//# sourceMappingURL=safety.js.map