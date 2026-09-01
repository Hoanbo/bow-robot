const serverUrl = process.env.BOW_VALIDATE_SERVER_URL || "http://127.0.0.1:3000";
const simulatorUrl = process.env.BOW_VALIDATE_SIMULATOR_URL || "http://127.0.0.1:3002";

async function check(url, label) {
    try {
        const response = await fetch(url);
        console.log(`${label}: ${response.status} ${response.statusText}`);
        return response.ok;
    } catch (error) {
        console.error(`${label}: unavailable (${error.message})`);
        return false;
    }
}

const serverOk = await check(`${serverUrl}/health`, "BOW Server");
console.log("Local validation complete. Start server, remote agent, and simulator before running this check.");
process.exitCode = serverOk ? 0 : 1;
