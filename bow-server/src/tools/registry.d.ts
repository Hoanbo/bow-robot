/**
 * Tool Registry
 * Manages available tools, their schemas, permissions, and discovery
 */
import { Logger, Tool, ToolResult, PermissionLevel } from "@bow/shared";
export interface ToolSchema {
    type: "object" | "string" | "number" | "boolean" | "array";
    properties?: Record<string, ToolSchema>;
    required?: string[];
    description?: string;
    enum?: string[];
    minLength?: number;
    maxLength?: number;
    pattern?: string;
}
export interface RegisteredTool extends Omit<Tool, "schema" | "permission"> {
    schema: ToolSchema;
    examples?: unknown[];
    category: string;
    permission: PermissionLevel;
}
export interface ToolRegistrationInput {
    name: string;
    description: string;
    category: string;
    permission?: PermissionLevel;
    handler?: (args: Record<string, unknown>) => Promise<ToolResult>;
    schema: ToolSchema;
}
export declare class ToolRegistry {
    private logger;
    private tools;
    private categories;
    constructor(logger: Logger);
    private registerDefaultTools;
    register(tool: ToolRegistrationInput): void;
    getTool(name: string): RegisteredTool | undefined;
    getAll(): RegisteredTool[];
    getByCategory(category: string): RegisteredTool[];
    getCategories(): string[];
    validateInput(toolName: string, input: unknown): {
        valid: boolean;
        errors: string[];
    };
    private validateSchema;
    getSafeTool(name: string): RegisteredTool | undefined;
    getInfo(): object;
}
export default ToolRegistry;
//# sourceMappingURL=registry.d.ts.map