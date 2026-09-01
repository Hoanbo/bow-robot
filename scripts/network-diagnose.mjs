import os from "node:os";
import net from "node:net";
import crypto from "node:crypto";
import WebSocket from "ws";

const env = process.env;
const host = env.BOW_SERVER_HOST || "127.0.0.1";
const address = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
const port = Number(env.BOW_SERVER_PORT || 3000);
const token = env.REMOTE_AGENT_TOKEN || "";
const endpoint = `${address}:${port}`;

function localIps() {
    return Object.values(os.networkInterfaces()).flatMap((items) =>
        (items || []).filter((item) => !item.internal && item.family === "IPv4").map((item) => item.address)
    );
}

function tcpCheck() {
    return new Promise((resolve) => {
        const socket = net.createConnection({ host: address, port, timeout: 3000 });
        socket.once("connect", () => { socket.destroy(); resolve(true); });
        socket.once("timeout", () => { socket.destroy(); resolve(false); });
        socket.once("error", () => resolve(false));
    });
}

function websocketCheck() {
    return new Promise((resolve) => {
        const ws = new WebSocket(`ws://${endpoint}/ws`);
        const requestId = crypto.randomUUID();
        const timer = setTimeout(() => { ws.terminate(); resolve({ reachable: false, authenticated: false }); }, 4000);
        ws.on("open", () => ws.send(JSON.stringify({ version: "1.0.0", requestId, sessionId: crypto.randomUUID(), type: "auth", token, timestamp: new Date().toISOString() })));
        ws.on("message", (data) => {
            try {
                const response = JSON.parse(data.toString());
                if (response.requestId !== requestId) return;
                clearTimeout(timer);
                ws.close();
                resolve({ reachable: true, authenticated: response.success === true });
            } catch { /* handled by timeout */ }
        });
        ws.on("error", () => { clearTimeout(timer); resolve({ reachable: false, authenticated: false }); });
    });
}

const ips = localIps();
const tcp = await tcpCheck();
const ws = tcp ? await websocketCheck() : { reachable: false, authenticated: false };

console.log("BOW Network Diagnostics");
console.log(`Local IP: ${ips.length ? ips.join(", ") : "not detected"}`);
console.log(`BOW Server: ${endpoint}`);
console.log(`TCP: ${tcp ? "PASS" : "FAIL"}`);
console.log(`WebSocket: ${ws.reachable ? "PASS" : "FAIL"}`);
console.log(`Authentication: ${ws.authenticated ? "PASS" : token ? "FAIL" : "NOT CONFIGURED"}`);
console.log(`Agent connection state: ${ws.authenticated ? "READY" : "UNAVAILABLE"}`);

if (!tcp || !ws.reachable || !ws.authenticated) process.exitCode = 1;
