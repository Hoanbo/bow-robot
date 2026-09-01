/**
 * Tool Registry
 * Manages available tools, their schemas, permissions, and discovery
 */
import { PERMISSION_LEVELS, getCurrentTimestamp } from "@bow/shared";
export class ToolRegistry {
    constructor(logger) {
        this.tools = new Map();
        this.categories = new Map();
        this.logger = logger;
        this.registerDefaultTools();
    }
    registerDefaultTools() {
        // Mouse tools
        this.register({
            name: "mouse_move",
            category: "mouse",
            permission: PERMISSION_LEVELS.SAFE,
            description: "Move mouse to coordinates",
            handler: async () => ({ success: true }),
            schema: {
                type: "object",
                properties: {
                    x: { type: "number", description: "X coordinate" },
                    y: { type: "number", description: "Y coordinate" },
                },
                required: ["x", "y"],
            },
        });
        this.register({
            name: "mouse_click",
            category: "mouse",
            permission: PERMISSION_LEVELS.SAFE,
            description: "Click at coordinates",
            handler: async () => ({ success: true }),
            schema: {
                type: "object",
                properties: {
                    x: { type: "number", description: "X coordinate" },
                    y: { type: "number", description: "Y coordinate" },
                    button: { type: "string", enum: ["left", "right", "middle"], description: "Mouse button" },
                },
                required: ["x", "y"],
            },
        });
        this.register({
            name: "mouse_double_click",
            category: "mouse",
            permission: PERMISSION_LEVELS.SAFE,
            description: "Double-click at coordinates",
            handler: async () => ({ success: true }),
            schema: {
                type: "object",
                properties: {
                    x: { type: "number", description: "X coordinate" },
                    y: { type: "number", description: "Y coordinate" },
                },
                required: ["x", "y"],
            },
        });
        this.register({
            name: "mouse_scroll",
            category: "mouse",
            permission: PERMISSION_LEVELS.SAFE,
            description: "Scroll in direction",
            handler: async () => ({ success: true }),
            schema: {
                type: "object",
                properties: {
                    direction: { type: "string", enum: ["up", "down"], description: "Scroll direction" },
                    amount: { type: "number", description: "Scroll amount" },
                },
                required: ["direction"],
            },
        });
        // Keyboard tools
        this.register({
            name: "keyboard_type",
            category: "keyboard",
            permission: PERMISSION_LEVELS.SAFE,
            description: "Type text",
            handler: async () => ({ success: true }),
            schema: {
                type: "object",
                properties: {
                    text: { type: "string", description: "Text to type", maxLength: 1000 },
                    delay: { type: "number", description: "Delay between keys in ms" },
                },
                required: ["text"],
            },
        });
        this.register({
            name: "keyboard_press",
            category: "keyboard",
            permission: PERMISSION_LEVELS.SAFE,
            description: "Press a key",
            handler: async () => ({ success: true }),
            schema: {
                type: "object",
                properties: {
                    key: { type: "string", description: "Key to press" },
                    modifiers: {
                        type: "array",
                        description: "Modifier keys",
                        enum: ["ctrl", "shift", "alt", "meta"],
                    },
                },
                required: ["key"],
            },
        });
        this.register({
            name: "keyboard_hotkey",
            category: "keyboard",
            permission: PERMISSION_LEVELS.SAFE,
            description: "Press hotkey combination",
            handler: async () => ({ success: true }),
            schema: {
                type: "object",
                properties: {
                    key: { type: "string", description: "Main key" },
                    modifiers: {
                        type: "array",
                        description: "Modifier keys",
                        enum: ["ctrl", "shift", "alt", "meta"],
                    },
                },
                required: ["key", "modifiers"],
            },
        });
        // Screen tools
        this.register({
            name: "screenshot",
            category: "screen",
            permission: PERMISSION_LEVELS.SAFE,
            description: "Take a screenshot",
            handler: async () => ({ success: true }),
            schema: {
                type: "object",
                properties: {},
            },
        });
        this.register({
            name: "get_screen_info",
            category: "screen",
            permission: PERMISSION_LEVELS.SAFE,
            description: "Get screen dimensions and content",
            handler: async () => ({ success: true }),
            schema: {
                type: "object",
                properties: {},
            },
        });
        this.register({
            name: "focus_window",
            category: "applications",
            permission: PERMISSION_LEVELS.SAFE,
            description: "Focus a visible application window",
            handler: async () => ({ success: true }),
            schema: { type: "object", properties: { name: { type: "string", description: "Window or application name" } }, required: ["name"] },
        });
        this.register({
            name: "get_windows",
            category: "applications",
            permission: PERMISSION_LEVELS.SAFE,
            description: "List visible application windows",
            handler: async () => ({ success: true }),
            schema: { type: "object", properties: {} },
        });
        // Application tools
        this.register({
            name: "open_application",
            category: "applications",
            permission: PERMISSION_LEVELS.SAFE,
            description: "Open an application",
            handler: async () => ({ success: true }),
            schema: {
                type: "object",
                properties: {
                    name: { type: "string", description: "Application name" },
                    args: {
                        type: "array",
                        description: "Command line arguments",
                    },
                },
                required: ["name"],
            },
        });
        this.register({
            name: "open_chrome",
            category: "applications",
            permission: PERMISSION_LEVELS.SAFE,
            description: "Open Chrome browser",
            handler: async () => ({ success: true }),
            schema: {
                type: "object",
                properties: {
                    url: { type: "string", description: "URL to open" },
                },
            },
        });
        this.register({
            name: "close_application",
            category: "applications",
            permission: PERMISSION_LEVELS.SAFE,
            description: "Close an application",
            handler: async () => ({ success: true }),
            schema: {
                type: "object",
                properties: {
                    name: { type: "string", description: "Application name" },
                },
                required: ["name"],
            },
        });
        // Browser tools
        this.register({
            name: "browser_open",
            category: "browser",
            permission: PERMISSION_LEVELS.SAFE,
            description: "Open web browser to URL",
            handler: async () => ({ success: true }),
            schema: {
                type: "object",
                properties: {
                    url: { type: "string", description: "URL to navigate to" },
                },
                required: ["url"],
            },
        });
        this.register({
            name: "browser_navigate",
            category: "browser",
            permission: PERMISSION_LEVELS.SAFE,
            description: "Navigate to URL in browser",
            handler: async () => ({ success: true }),
            schema: {
                type: "object",
                properties: {
                    url: { type: "string", description: "URL to navigate to" },
                },
                required: ["url"],
            },
        });
        this.register({
            name: "browser_search",
            category: "browser",
            permission: PERMISSION_LEVELS.SAFE,
            description: "Search the web",
            handler: async () => ({ success: true }),
            schema: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Search query" },
                    engine: { type: "string", enum: ["google", "bing", "duckduckgo"], description: "Search engine" },
                },
                required: ["query"],
            },
        });
        this.register({
            name: "browser_screenshot",
            category: "browser",
            permission: PERMISSION_LEVELS.SAFE,
            description: "Take screenshot of current webpage",
            handler: async () => ({ success: true }),
            schema: {
                type: "object",
                properties: {},
            },
        });
        // File tools
        this.register({
            name: "file_read",
            category: "files",
            permission: PERMISSION_LEVELS.SAFE,
            description: "Read file contents",
            handler: async () => ({ success: true }),
            schema: {
                type: "object",
                properties: {
                    path: { type: "string", description: "File path" },
                },
                required: ["path"],
            },
        });
        this.register({
            name: "file_write",
            category: "files",
            permission: PERMISSION_LEVELS.CONFIRM,
            description: "Write to file",
            handler: async () => ({ success: true }),
            schema: {
                type: "object",
                properties: {
                    path: { type: "string", description: "File path" },
                    content: { type: "string", description: "File content" },
                    append: { type: "boolean", description: "Append to file" },
                },
                required: ["path", "content"],
            },
        });
        this.register({
            name: "file_list",
            category: "files",
            permission: PERMISSION_LEVELS.SAFE,
            description: "List directory contents",
            handler: async () => ({ success: true }),
            schema: {
                type: "object",
                properties: {
                    path: { type: "string", description: "Directory path" },
                },
                required: ["path"],
            },
        });
        this.register({
            name: "file_search",
            category: "files",
            permission: PERMISSION_LEVELS.SAFE,
            description: "Search for files",
            handler: async () => ({ success: true }),
            schema: {
                type: "object",
                properties: {
                    pattern: { type: "string", description: "Search pattern" },
                    path: { type: "string", description: "Search path" },
                },
                required: ["pattern"],
            },
        });
        // Terminal tools
        this.register({
            name: "terminal_execute",
            category: "terminal",
            permission: PERMISSION_LEVELS.CONFIRM,
            description: "Execute terminal command",
            handler: async () => ({ success: true }),
            schema: {
                type: "object",
                properties: {
                    command: { type: "string", description: "Command to execute" },
                    cwd: { type: "string", description: "Working directory" },
                },
                required: ["command"],
            },
        });
        this.register({
            name: "terminal_get_info",
            category: "terminal",
            permission: PERMISSION_LEVELS.SAFE,
            description: "Get terminal/working directory info",
            handler: async () => ({ success: true }),
            schema: {
                type: "object",
                properties: {},
            },
        });
        this.logger.debug("Default tools registered", {
            toolCount: this.tools.size,
            categories: Array.from(this.categories.keys()),
        });
    }
    register(tool) {
        if (this.tools.has(tool.name)) {
            this.logger.warn(`Tool ${tool.name} already registered, overwriting`);
        }
        const registered = {
            ...tool,
            category: tool.category || "general",
            permission: tool.permission || PERMISSION_LEVELS.SAFE,
            schema: tool.schema,
        };
        this.tools.set(tool.name, registered);
        // Update category index
        if (!this.categories.has(registered.category)) {
            this.categories.set(registered.category, []);
        }
        this.categories.get(registered.category).push(tool.name);
        this.logger.debug(`Tool registered: ${tool.name}`, {
            category: registered.category,
            permission: registered.permission,
        });
    }
    getTool(name) {
        return this.tools.get(name);
    }
    getAll() {
        return Array.from(this.tools.values());
    }
    getByCategory(category) {
        const names = this.categories.get(category) || [];
        return names.map((name) => this.tools.get(name)).filter(Boolean);
    }
    getCategories() {
        return Array.from(this.categories.keys());
    }
    validateInput(toolName, input) {
        const tool = this.getTool(toolName);
        if (!tool) {
            return { valid: false, errors: [`Unknown tool: ${toolName}`] };
        }
        const errors = this.validateSchema(tool.schema, input);
        return { valid: errors.length === 0, errors };
    }
    validateSchema(schema, value, path = "") {
        const errors = [];
        if (schema.type === "object") {
            if (typeof value !== "object" || value === null || Array.isArray(value)) {
                errors.push(`${path} must be an object`);
                return errors;
            }
            const obj = value;
            // Check required fields
            if (schema.required) {
                for (const required of schema.required) {
                    if (!(required in obj)) {
                        errors.push(`${path}.${required} is required`);
                    }
                }
            }
            // Validate properties
            if (schema.properties) {
                for (const [key, propSchema] of Object.entries(schema.properties)) {
                    if (key in obj) {
                        errors.push(...this.validateSchema(propSchema, obj[key], `${path}.${key}`));
                    }
                }
            }
        }
        else if (schema.type === "string") {
            if (typeof value !== "string") {
                errors.push(`${path} must be a string`);
            }
            else {
                if (schema.minLength && value.length < schema.minLength) {
                    errors.push(`${path} must be at least ${schema.minLength} characters`);
                }
                if (schema.maxLength && value.length > schema.maxLength) {
                    errors.push(`${path} must be at most ${schema.maxLength} characters`);
                }
                if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
                    errors.push(`${path} does not match pattern ${schema.pattern}`);
                }
                if (schema.enum && !schema.enum.includes(value)) {
                    errors.push(`${path} must be one of: ${schema.enum.join(", ")}`);
                }
            }
        }
        else if (schema.type === "number") {
            if (typeof value !== "number") {
                errors.push(`${path} must be a number`);
            }
        }
        else if (schema.type === "boolean") {
            if (typeof value !== "boolean") {
                errors.push(`${path} must be a boolean`);
            }
        }
        else if (schema.type === "array") {
            if (!Array.isArray(value)) {
                errors.push(`${path} must be an array`);
            }
        }
        return errors;
    }
    getSafeTool(name) {
        const tool = this.getTool(name);
        if (!tool)
            return undefined;
        if (tool.permission === PERMISSION_LEVELS.SAFE) {
            return tool;
        }
        return undefined;
    }
    getInfo() {
        return {
            toolCount: this.tools.size,
            categories: Array.from(this.categories.keys()),
            tools: Array.from(this.tools.values()).map((t) => ({
                name: t.name,
                description: t.description,
                category: t.category,
                permission: t.permission,
            })),
            timestamp: getCurrentTimestamp(),
        };
    }
}
export default ToolRegistry;
//# sourceMappingURL=registry.js.map