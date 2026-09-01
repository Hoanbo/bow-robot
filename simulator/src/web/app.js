// Virtual Desktop Robot Simulator Client
// OLED 128x64 Animated Eyes Renderer, Web Audio Mic, and Telemetry

class VirtualRobotApp {
    constructor() {
        this.canvas = document.getElementById("oled-canvas");
        this.ctx = this.canvas.getContext("2d");
        this.ws = null;
        this.currentExpression = "neutral";
        this.currentMode = "idle";
        this.panTilt = { pan: 0, tilt: 0 };
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.audioContext = null;
        this.analyser = null;
        this.speechRecognition = null;
        this.lastFrameTime = performance.now();
        this.fpsCounter = document.getElementById("fps-counter");
        this.frameCount = 0;
        this.fpsTimer = performance.now();

        // Eye animation state
        this.blinkProgress = 0;
        this.isBlinking = false;
        this.nextBlinkTime = Date.now() + 2000;
        this.thinkAngle = 0;

        this.initUI();
        this.initWebSocket();
        this.initSpeechRecognition();
        this.startRenderLoop();
    }

    initUI() {
        // Pan & Tilt sliders
        const panSlider = document.getElementById("pan-slider");
        const tiltSlider = document.getElementById("tilt-slider");
        const panVal = document.getElementById("pan-val");
        const tiltVal = document.getElementById("tilt-val");

        panSlider.addEventListener("input", (e) => {
            this.panTilt.pan = parseInt(e.target.value, 10);
            panVal.textContent = `${this.panTilt.pan}°`;
            this.sendRobotCommand("move_head", { pan: this.panTilt.pan, tilt: this.panTilt.tilt });
        });

        tiltSlider.addEventListener("input", (e) => {
            this.panTilt.tilt = parseInt(e.target.value, 10);
            tiltVal.textContent = `${this.panTilt.tilt}°`;
            this.sendRobotCommand("move_head", { pan: this.panTilt.pan, tilt: this.panTilt.tilt });
        });

        // Expression buttons
        document.querySelectorAll(".btn-exp").forEach((btn) => {
            btn.addEventListener("click", () => {
                const exp = btn.getAttribute("data-exp");
                this.setExpression(exp);
                this.sendRobotCommand("set_expression", { expression: exp });
                document.querySelectorAll(".btn-exp").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
            });
        });

        // Mic Push-to-Talk
        const micBtn = document.getElementById("mic-btn");
        micBtn.addEventListener("click", () => this.toggleMic());

        // Query Form
        const queryForm = document.getElementById("query-form");
        const queryInput = document.getElementById("query-input");
        queryForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const text = queryInput.value.trim();
            if (text) {
                this.handleUserQuery(text);
                queryInput.value = "";
            }
        });

        // Clear Log
        document.getElementById("clear-log-btn").addEventListener("click", () => {
            document.getElementById("log-content").innerHTML = "";
        });
    }

    initWebSocket() {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}`;

        this.log(`Connecting to Simulator Gateway (${wsUrl})...`, "info");
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            document.getElementById("status-dot").classList.add("connected");
            document.getElementById("gateway-status").textContent = "GATEWAY: CONNECTED";
            this.log("Connected to Robot Gateway", "action");
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this.handleGatewayMessage(msg);
            } catch (err) {
                console.error("WS Parse error", err);
            }
        };

        this.ws.onclose = () => {
            document.getElementById("status-dot").classList.remove("connected");
            document.getElementById("gateway-status").textContent = "GATEWAY: DISCONNECTED";
            this.log("Disconnected from Gateway. Retrying in 3s...", "warn");
            setTimeout(() => this.initWebSocket(), 3000);
        };
    }

    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.speechRecognition = new SpeechRecognition();
            this.speechRecognition.lang = "vi-VN";
            this.speechRecognition.continuous = false;
            this.speechRecognition.interimResults = true;

            this.speechRecognition.onresult = (event) => {
                let interim = "";
                let final = "";
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        final += event.results[i][0].transcript;
                    } else {
                        interim += event.results[i][0].transcript;
                    }
                }
                const preview = document.getElementById("stt-preview");
                preview.textContent = final || interim || "...";
                if (final) {
                    this.log(`STT Recognized: "${final}"`, "info");
                    this.handleUserQuery(final);
                    this.stopMic();
                }
            };

            this.speechRecognition.onerror = (e) => {
                this.log(`STT Speech error: ${e.error}`, "warn");
                this.stopMic();
            };
        }
    }

    async toggleMic() {
        if (!this.isRecording) {
            this.startMic();
        } else {
            this.stopMic();
        }
    }

    async startMic() {
        this.isRecording = true;
        const micBtn = document.getElementById("mic-btn");
        micBtn.classList.add("recording");
        document.getElementById("mic-btn-text").textContent = "ĐANG LẮNG NGHE...";
        this.setMode("listening");
        this.setExpression("listening");

        if (this.speechRecognition) {
            try { this.speechRecognition.start(); } catch {}
        }

        // Setup audio level visualizer
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 64;
            source.connect(this.analyser);
            this.monitorAudioLevel();
        } catch (err) {
            this.log(`Microphone permission error: ${err.message}`, "error");
        }
    }

    stopMic() {
        this.isRecording = false;
        const micBtn = document.getElementById("mic-btn");
        micBtn.classList.remove("recording");
        document.getElementById("mic-btn-text").textContent = "BẤM ĐỂ NÓI (MIC)";
        if (this.currentMode === "listening") this.setMode("idle");
        if (this.currentExpression === "listening") this.setExpression("neutral");

        if (this.speechRecognition) {
            try { this.speechRecognition.stop(); } catch {}
        }
        document.getElementById("audio-level-bar").style.width = "0%";
    }

    monitorAudioLevel() {
        if (!this.isRecording || !this.analyser) return;
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length;
        const percent = Math.min(100, Math.round((average / 128) * 100));
        document.getElementById("audio-level-bar").style.width = `${percent}%`;
        requestAnimationFrame(() => this.monitorAudioLevel());
    }

    async handleUserQuery(text) {
        this.log(`User query: "${text}"`, "info");
        this.setMode("thinking");
        this.setExpression("thinking");

        // Forward query to Simulator server
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: "user.query",
                query: text,
                timestamp: new Date().toISOString(),
            }));
        }
    }

    handleGatewayMessage(msg) {
        if (msg.type === "robot.state" && msg.state) {
            if (msg.state.expression) this.setExpression(msg.state.expression);
            if (msg.state.mode) this.setMode(msg.state.mode);
        } else if (msg.type === "agent.response") {
            this.log(`BOW Brain: "${msg.text}"`, "action");
            if (msg.expression) this.setExpression(msg.expression);
            this.setMode("speaking");

            // Play TTS audio if provided
            if (msg.audioBase64) {
                this.playAudioBase64(msg.audioBase64, msg.mimeType || "audio/mpeg");
            } else {
                // Synthesize browser voice fallback or speak duration
                this.speakBrowserVoice(msg.text);
            }
        } else if (msg.type === "desktop_action") {
            this.log(`Desktop Action Dispatched: [${msg.action}] ${msg.target || ""}`, "action");
        }
    }

    playAudioBase64(base64Data, mimeType) {
        const audio = new Audio(`data:${mimeType};base64,${base64Data}`);
        audio.onended = () => {
            this.setMode("idle");
            this.setExpression("neutral");
        };
        audio.play().catch(() => {});
    }

    speakBrowserVoice(text) {
        if ("speechSynthesis" in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = "vi-VN";
            utterance.onend = () => {
                this.setMode("idle");
                this.setExpression("neutral");
            };
            window.speechSynthesis.speak(utterance);
        } else {
            setTimeout(() => {
                this.setMode("idle");
                this.setExpression("neutral");
            }, 2500);
        }
    }

    setExpression(exp) {
        this.currentExpression = exp;
        document.getElementById("current-expression-label").textContent = `EXPRESSION: ${exp.toUpperCase()}`;
    }

    setMode(mode) {
        this.currentMode = mode;
        document.getElementById("current-mode-label").textContent = `MODE: ${mode.toUpperCase()}`;
    }

    sendRobotCommand(type, parameters) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type,
                parameters,
                timestamp: new Date().toISOString(),
            }));
        }
    }

    log(text, level = "info") {
        const logContent = document.getElementById("log-content");
        const line = document.createElement("div");
        line.className = `log-line ${level}`;
        const time = new Date().toLocaleTimeString();
        line.textContent = `[${time}] ${text}`;
        logContent.appendChild(line);
        logContent.scrollTop = logContent.scrollHeight;
    }

    startRenderLoop() {
        const render = (time) => {
            const dt = time - this.lastFrameTime;
            this.lastFrameTime = time;

            this.updateEyeAnimation(dt);
            this.drawOLED();

            // Calculate FPS
            this.frameCount++;
            if (time - this.fpsTimer >= 1000) {
                this.fpsCounter.textContent = `${this.frameCount} FPS`;
                this.frameCount = 0;
                this.fpsTimer = time;
            }

            requestAnimationFrame(render);
        };
        requestAnimationFrame(render);
    }

    updateEyeAnimation(dt) {
        const now = Date.now();
        if (!this.isBlinking && now >= this.nextBlinkTime && this.currentExpression !== "sleeping") {
            this.isBlinking = true;
            this.blinkProgress = 0;
        }

        if (this.isBlinking) {
            this.blinkProgress += dt / 130;
            if (this.blinkProgress >= 1) {
                this.isBlinking = false;
                this.blinkProgress = 0;
                this.nextBlinkTime = now + 2500 + Math.random() * 3500;
            }
        }

        this.thinkAngle += (dt / 1000) * 3;
    }

    drawOLED() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const scaleX = w / 128;
        const scaleY = h / 64;

        // Clear OLED background
        ctx.fillStyle = "#030a06";
        ctx.fillRect(0, 0, w, h);

        const panOffset = (this.panTilt.pan / 90) * 12;
        const tiltOffset = (this.panTilt.tilt / 45) * 8;

        const leftEyeCenter = { x: (38 + panOffset) * scaleX, y: (32 + tiltOffset) * scaleY };
        const rightEyeCenter = { x: (90 + panOffset) * scaleX, y: (32 + tiltOffset) * scaleY };

        // Eye styling: Retro OLED Cyan Glow
        ctx.fillStyle = "#38ef7d";
        ctx.shadowColor = "#38ef7d";
        ctx.shadowBlur = 12;

        const blinkClose = this.isBlinking ? (this.blinkProgress <= 0.5 ? this.blinkProgress * 2 : (1 - this.blinkProgress) * 2) : 0;

        // Draw Left & Right Eyes based on expression
        this.drawSingleEye(ctx, leftEyeCenter.x, leftEyeCenter.y, scaleX, scaleY, blinkClose, false);
        this.drawSingleEye(ctx, rightEyeCenter.x, rightEyeCenter.y, scaleX, scaleY, true);

        ctx.shadowBlur = 0; // reset
    }

    drawSingleEye(ctx, cx, cy, sx, sy, blinkRatio, isRight) {
        const exp = this.currentExpression;
        let eyeW = 28 * sx;
        let eyeH = 34 * sy;

        if (blinkRatio > 0) {
            eyeH = Math.max(4, eyeH * (1 - blinkRatio));
        }

        ctx.beginPath();

        if (exp === "happy") {
            // Crescent happy eye (inverted arc)
            ctx.arc(cx, cy + 4 * sy, eyeW / 2, Math.PI, 0, false);
            ctx.lineWidth = 8 * sy;
            ctx.strokeStyle = "#38ef7d";
            ctx.stroke();
            return;
        }

        if (exp === "sleeping") {
            // Sleeping closed horizontal eyelid
            ctx.roundRect(cx - eyeW / 2, cy - 3 * sy, eyeW, 6 * sy, 3 * sy);
            ctx.fill();
            return;
        }

        if (exp === "surprised") {
            eyeW = 34 * sx;
            eyeH = 42 * sy;
            ctx.ellipse(cx, cy, eyeW / 2, eyeH / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        if (exp === "thinking") {
            const pupilX = Math.cos(this.thinkAngle) * 5 * sx;
            const pupilY = -6 * sy;
            ctx.roundRect(cx - eyeW / 2, cy - (eyeH * 0.8) / 2, eyeW, eyeH * 0.8, 8 * sx);
            ctx.fill();
            return;
        }

        if (exp === "speaking") {
            const osc = Math.sin(Date.now() / 120) * 6 * sy;
            eyeH = Math.max(16 * sy, eyeH + osc);
        }

        // Standard Rounded Pill Eye (Neutral, Blink, Listening, Speaking)
        const radius = Math.min(eyeW, eyeH) / 2;
        ctx.roundRect(cx - eyeW / 2, cy - eyeH / 2, eyeW, eyeH, radius);
        ctx.fill();
    }
}

// Start app on DOMContentLoaded
window.addEventListener("DOMContentLoaded", () => {
    window.robotApp = new VirtualRobotApp();
});
