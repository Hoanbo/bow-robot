/**
 * PHASE 4 Integration Test
 * Basic test scenarios for Tool Registry, AI Agent, and Execution System
 */
import { Logger } from "@bow/shared";
import ToolRegistry from "../bow-server/src/tools/registry.js";
import ToolExecutor from "../bow-server/src/tools/executor.js";
import AIAgent from "../bow-server/src/agent/index.js";
import Planner from "../bow-server/src/agent/planner.js";
const logger = Logger.create("phase-4-test");
async function runTests() {
    logger.info("PHASE 4 Integration Tests Starting");
    try {
        // Test 1: Tool Registry
        logger.info("Test 1: Tool Registry");
        const registry = new ToolRegistry(logger);
        const allTools = registry.getAll();
        logger.info(`Registry loaded with ${allTools.length} tools`);
        const mouseTools = registry.getByCategory("mouse");
        logger.info(`Found ${mouseTools.length} mouse tools`);
        const categories = registry.getCategories();
        logger.info(`Available categories: ${categories.join(", ")}`);
        // Test 2: Tool Validation
        logger.info("Test 2: Tool Validation");
        const validation1 = registry.validateInput("mouse_click", { x: 100, y: 200 });
        logger.info(`Validation (valid input): ${validation1.valid}`);
        const validation2 = registry.validateInput("mouse_click", { x: "invalid" });
        logger.info(`Validation (invalid input): ${validation2.valid}, Errors: ${validation2.errors.join(", ")}`);
        const validation3 = registry.validateInput("unknown_tool", {});
        logger.info(`Validation (unknown tool): ${validation3.valid}`);
        // Test 3: Planner
        logger.info("Test 3: Planner");
        const planner = new Planner(logger, registry);
        const plan1 = planner.plan("open chrome");
        logger.info(`Plan created for 'open chrome': ${plan1.steps.length} steps`);
        const plan2 = planner.plan("search for ai robots");
        logger.info(`Plan created for 'search for ai robots': ${plan2.steps.length} steps`);
        const plan3 = planner.plan("type 'hello world'");
        logger.info(`Plan created for 'type hello world': ${plan3.steps.length} steps`);
        // Test 4: Plan Validation
        logger.info("Test 4: Plan Validation");
        const planValidation = planner.validatePlan(plan1);
        logger.info(`Plan validation: ${planValidation.valid}`);
        if (!planValidation.valid) {
            logger.warn(`Validation errors: ${planValidation.errors.join(", ")}`);
        }
        // Test 5: AI Agent - Natural Language Processing
        logger.info("Test 5: AI Agent");
        const toolExecutor = new ToolExecutor(logger, registry);
        const agent = new AIAgent(logger, registry, toolExecutor);
        logger.info("Processing natural language inputs...");
        const turn1 = await agent.processInput("open chrome");
        logger.info(`Turn 1 Response: ${turn1.response}`);
        const turn2 = await agent.processInput("search for bob the robot", turn1.id);
        logger.info(`Turn 2 Response: ${turn2.response}`);
        const turn3 = await agent.processInput("type 'hello'", turn1.id);
        logger.info(`Turn 3 Response: ${turn3.response}`);
        // Test 6: Agent Statistics
        logger.info("Test 6: Agent Statistics");
        const stats = agent.getStats();
        logger.info(`Agent stats:`, stats);
        // Test 7: Tool Information
        logger.info("Test 7: Tool Information");
        const toolInfo = agent.getToolInfo();
        logger.info(`Tool info:`, toolInfo);
        logger.info("✓ PHASE 4 Integration Tests Completed Successfully");
    }
    catch (error) {
        logger.error("Test failed", error instanceof Error ? error : new Error(String(error)));
        process.exit(1);
    }
}
// Run tests
runTests().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
//# sourceMappingURL=phase-4-integration.js.map