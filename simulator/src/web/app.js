// Virtual Desktop Robot Simulator Client V4.0
// OLED 128x64 10-Expression Animated Eyes Renderer, Web Audio Mic, and Realtime Telemetry

class VirtualRobotApp {
    constructor() {
        this.canvas = document.getElementById("oled-canvas");
        this.ctx = this.canvas.getContext("2d");
        this.ws = null;
        this.currentExpression = "neutral";
        this.currentMode = "idle";
        this.panTilt = { pan: 0, tilt: 0 };
        this.isRecording = false;
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
        this.matrixTicks = 0;
        this.lovePhase = 0;
        this.speakPhase = 0;

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

        // 10 Expression buttons
        document.querySelectorAll(".btn-exp").forEach((btn) => {
            btn.addEventListener("click", () => {
                const exp = btn.getAttribute("data-exp");
                this.setExpression(exp);
                this.sendRobotCommand("set_expression", { expression: exp });
                document.querySelectorAll(".btn-exp").forEach((b) => b.classList.remove("active"));
                btn.classList.add("active");
            });
        });

        // Sound Tracking AoA Slider
        const aoaSlider = document.getElementById("aoa-slider");
        const aoaVal = document.getElementById("aoa-val");
        if (aoaSlider) {
            aoaSlider.addEventListener("input", (e) => {
                const val = parseInt(e.target.value, 10);
                if (aoaVal) aoaVal.textContent = `${val}°`;
                this.log(`🎯 Sound Tracking AoA directed to ${val}°`, "action");
                this.sendRobotCommand("robot.sound_direction", { angleAoA: val });
            });
        }

        // Proactive Event: Morning Briefing
        const morningBtn = document.getElementById("morning-btn");
        if (morningBtn) {
            morningBtn.addEventListener("click", () => {
                this.log("🌅 Kích hoạt Bản tin sáng 8:00 AM...", "action");
                this.sendRobotCommand("robot.proactive_event", {
                    event: "morning_briefing",
                    speechText: "Kính chào Ngài! Tôi là BOWCON đây ạ. Chúc Ngài một ngày làm việc sáng suốt và đắc thắng! Tôi đã bật đèn bàn làm việc cho Ngài.",
                });
            });
        }

        // Proactive Event: Sedentary Health Alert
        const healthBtn = document.getElementById("health-btn");
        if (healthBtn) {
            healthBtn.addEventListener("click", () => {
                this.log("💧 Kích hoạt Cảnh báo sức khỏe ngồi > 45 phút...", "action");
                this.sendRobotCommand("robot.proactive_event", {
                    event: "sedentary_reminder",
                    speechText: "Thưa Ngài, Ngài đã ngồi lập trình liên tục hơn 45 phút. Kính mong Ngài đứng dậy vươn vai và dùng chút nước để bảo vệ sức khỏe.",
                });
            });
        }

        // Barge-in Interrupt Button
        const interruptBtn = document.getElementById("interrupt-btn");
        if (interruptBtn) {
            interruptBtn.addEventListener("click", () => {
                this.log("⚡ Triggering Barge-in interrupt...", "warn");
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({ type: "robot.interrupt", timestamp: new Date().toISOString() }));
                }
            });
        }

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
            this.log("Connected to BOWCON Robot V4.0 Gateway", "action");
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
            this.log("Disconnected from Gateway. Retrying in 2.5s...", "warn");
            setTimeout(() => this.initWebSocket(), 2500);
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

    async handleUserQuery(text) {
        this.log(`User query: "${text}"`, "info");
        this.setMode("thinking");
        this.setExpression("thinking");

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
            if (msg.state.headPosition) {
                this.panTilt = msg.state.headPosition;
                document.getElementById("pan-slider").value = this.panTilt.pan;
                document.getElementById("tilt-slider").value = this.panTilt.tilt;
                document.getElementById("pan-val").textContent = `${this.panTilt.pan}°`;
                document.getElementById("tilt-val").textContent = `${this.panTilt.tilt}°`;
            }
        } else if (msg.type === "robot.telemetry" || msg.type === "robot.sensors_telemetry") {
            const battEl = document.getElementById("battery-stat");
            const rssiEl = document.getElementById("rssi-stat");
            const uptimeEl = document.getElementById("uptime-stat");
            const batteryVal = msg.batteryPercent !== undefined ? msg.batteryPercent : msg.battery;
            if (battEl && batteryVal !== undefined) {
                battEl.textContent = `🔋 PIN: ${batteryVal}% ${msg.voltage ? `(${msg.voltage.toFixed(2)}V)` : ""}`;
            }
            if (rssiEl && msg.wifiRssi !== undefined) {
                rssiEl.textContent = `📶 RSSI: ${msg.wifiRssi} dBm`;
            }
            if (uptimeEl && msg.uptime !== undefined) {
                uptimeEl.textContent = `⏱️ UPTIME: ${msg.uptime}s`;
            }
            if (msg.type === "robot.sensors_telemetry") {
                this.log(`📡 Telemetry V4.0: Pin ${batteryVal}%, Temp: ${msg.temperatureCelsius || 35.4}°C, Charging: ${msg.isCharging ? "Có" : "Không"}`, "info");
            }
        } else if (msg.type === "robot.sound_direction") {
            this.log(`🎯 Sound Direction AoA: ${msg.angleAoA}°`, "action");
            const aoaSlider = document.getElementById("aoa-slider");
            const aoaVal = document.getElementById("aoa-val");
            if (aoaSlider) aoaSlider.value = msg.angleAoA;
            if (aoaVal) aoaVal.textContent = `${msg.angleAoA}°`;
        } else if (msg.type === "robot.proactive_event") {
            this.log(`🌟 Proactive Event [${msg.event}]: "${msg.speechText}"`, "action");
            if (msg.emotion) this.setExpression(msg.emotion);
            if (msg.deskLight) {
                this.log(`💡 Đèn bàn thông minh: ${msg.deskLight.toUpperCase()}`, "action");
            }
        } else if (msg.type === "robot.interrupt" || msg.action === "stop_playback") {
            this.log("⚡ [BARGE-IN] Received interrupt! Head tilted, listening mode active", "warn");
            this.setExpression("listening");
            this.setMode("listening");
        } else if (msg.type === "agent.response") {
            this.log(`BOW Brain: "${msg.text}"`, "action");
            if (msg.expression) this.setExpression(msg.expression);
            this.setMode("speaking");

            if (msg.audioBase64) {
                this.playAudioBase64(msg.audioBase64, msg.mimeType || "audio/mpeg");
            } else {
                this.speakBrowserVoice(msg.text);
            }
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
        if (!logContent) return;
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
        const skipBlink = ["sleeping", "matrix", "error", "battery_low"].includes(this.currentExpression);
        if (!skipBlink) {
            if (!this.isBlinking && now >= this.nextBlinkTime) {
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
        }

        this.thinkAngle += (dt / 1000) * 3.5;
        this.speakPhase += (dt / 1000) * 8;
        this.lovePhase += (dt / 1000) * 4;
        this.matrixTicks += dt;
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

        // Draw Left & Right Eyes based on 10 Expressions
        this.drawSingleEye(ctx, leftEyeCenter.x, leftEyeCenter.y, scaleX, scaleY, blinkClose, false);
        this.drawSingleEye(ctx, rightEyeCenter.x, rightEyeCenter.y, scaleX, scaleY, blinkClose, true);

        // Battery Low Extra Bar
        if (this.currentExpression === "battery_low" && Math.floor(Date.now() / 500) % 2 === 0) {
            ctx.strokeStyle = "#ff4757";
            ctx.fillStyle = "#ff4757";
            ctx.shadowColor = "#ff4757";
            ctx.lineWidth = 2 * scaleX;
            ctx.strokeRect(44 * scaleX, 52 * scaleY, 40 * scaleX, 10 * scaleY);
            ctx.fillRect(84 * scaleX, 55 * scaleY, 3 * scaleX, 4 * scaleY);
            ctx.fillRect(46 * scaleX, 54 * scaleY, 8 * scaleX, 6 * scaleY);
        }

        ctx.shadowBlur = 0;
    }

    drawSingleEye(ctx, cx, cy, sx, sy, blinkRatio, isRight) {
        const exp = this.currentExpression;
        let eyeW = 28 * sx;
        let eyeH = 34 * sy;

        if (blinkRatio > 0 && !["sleeping", "matrix", "error", "battery_low"].includes(exp)) {
            eyeH = Math.max(4, eyeH * (1 - blinkRatio));
            const radius = Math.min(eyeW, eyeH) / 2;
            ctx.beginPath();
            ctx.roundRect(cx - eyeW / 2, cy - eyeH / 2, eyeW, eyeH, radius);
            ctx.fill();
            return;
        }

        ctx.beginPath();

        // 1. EXP_HAPPY: (^ _ ^)
        if (exp === "happy") {
            ctx.arc(cx, cy + 4 * sy, eyeW / 2, Math.PI, 0, false);
            ctx.lineWidth = 8 * sy;
            ctx.strokeStyle = "#38ef7d";
            ctx.stroke();
            return;
        }

        // 2. EXP_CURIOUS: one eye raised high, one slightly squinched
        if (exp === "curious") {
            if (!isRight) {
                eyeW = 34 * sx;
                eyeH = 38 * sy;
                ctx.roundRect(cx - eyeW / 2, cy - eyeH / 2 - 4 * sy, eyeW, eyeH, 10 * sx);
            } else {
                eyeW = 24 * sx;
                eyeH = 20 * sy;
                ctx.roundRect(cx - eyeW / 2, cy - eyeH / 2 + 2 * sy, eyeW, eyeH, 6 * sx);
            }
            ctx.fill();
            return;
        }

        // 3. EXP_THINKING: Revolving pupils (O _ o)
        if (exp === "thinking") {
            const pX = Math.cos(this.thinkAngle) * 5 * sx;
            const pY = Math.sin(this.thinkAngle) * 5 * sy;
            ctx.roundRect(cx - eyeW / 2, cy - eyeH / 2, eyeW, eyeH, 8 * sx);
            ctx.fill();
            // Pupil cutout
            ctx.fillStyle = "#030a06";
            ctx.beginPath();
            ctx.arc(cx + pX, cy + pY, 5 * sx, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#38ef7d";
            return;
        }

        // 4. EXP_LISTENING: Big attentive round eyes
        if (exp === "listening") {
            eyeW = 32 * sx;
            eyeH = 38 * sy;
            ctx.roundRect(cx - eyeW / 2, cy - eyeH / 2, eyeW, eyeH, 12 * sx);
            ctx.fill();
            // Focused pupil
            ctx.fillStyle = "#030a06";
            ctx.beginPath();
            ctx.arc(cx, cy + 2 * sy, 6 * sx, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#38ef7d";
            return;
        }

        // 5. EXP_SPEAKING: Wave reactive bouncing eyes
        if (exp === "speaking") {
            const bounce = Math.abs(Math.sin(this.speakPhase) * 12 * sy);
            eyeH = 26 * sy + bounce;
            ctx.roundRect(cx - eyeW / 2, cy - eyeH / 2, eyeW, eyeH, 8 * sx);
            ctx.fill();
            return;
        }

        // 6. EXP_LOVE: (<3 _ <3)
        if (exp === "love") {
            const pulse = Math.sin(this.lovePhase) * 3 * sx;
            ctx.fillStyle = "#ff7675";
            ctx.shadowColor = "#ff7675";
            const hW = 28 * sx + pulse;
            const topY = cy - 8 * sy;
            ctx.beginPath();
            ctx.arc(cx - hW / 4, topY, hW / 4, Math.PI, 0, false);
            ctx.arc(cx + hW / 4, topY, hW / 4, Math.PI, 0, false);
            ctx.lineTo(cx, cy + 14 * sy + pulse);
            ctx.closePath();
            ctx.fill();
            return;
        }

        // 7. EXP_MATRIX: Digital matrix code rain
        if (exp === "matrix") {
            ctx.strokeStyle = "#2ed573";
            ctx.strokeRect(cx - eyeW / 2, cy - eyeH / 2, eyeW, eyeH);
            for (let col = 0; col < 5; col++) {
                const dropY = ((this.matrixTicks / 80 + col * 7) % 24) * sy;
                ctx.fillStyle = "#2ed573";
                ctx.fillRect(cx - eyeW / 2 + 3 * sx + col * 5 * sx, cy - eyeH / 2 + dropY, 3 * sx, 4 * sy);
            }
            return;
        }

        // 8. EXP_ERROR: (X _ X)
        if (exp === "error") {
            ctx.strokeStyle = "#ff4757";
            ctx.shadowColor = "#ff4757";
            ctx.lineWidth = 6 * sx;
            ctx.beginPath();
            ctx.moveTo(cx - 14 * sx, cy - 14 * sy);
            ctx.lineTo(cx + 14 * sx, cy + 14 * sy);
            ctx.moveTo(cx - 14 * sx, cy + 14 * sy);
            ctx.lineTo(cx + 14 * sx, cy - 14 * sy);
            ctx.stroke();
            return;
        }

        // 9. EXP_BATTERY_LOW: Drooping sad eyes
        if (exp === "battery_low") {
            ctx.fillStyle = "#ffa502";
            ctx.shadowColor = "#ffa502";
            ctx.roundRect(cx - eyeW / 2, cy - 6 * sy, eyeW, 16 * sy, 4 * sx);
            ctx.fill();
            return;
        }

        // 10. EXP_SLEEPING: Closed peaceful curved eyelid with breathing oscillation
        if (exp === "sleeping") {
            const breath = Math.sin(Date.now() / 800) * 2 * sy;
            ctx.strokeStyle = "#38ef7d";
            ctx.shadowColor = "#38ef7d";
            ctx.lineWidth = 5 * sy;
            ctx.beginPath();
            ctx.arc(cx, cy + 8 * sy + breath, eyeW / 2, 0, Math.PI, false);
            ctx.stroke();
            return;
        }

        // 11. EXP_SURPRISED: Big wide open circular eyes
        if (exp === "surprised") {
            eyeW = 36 * sx;
            eyeH = 44 * sy;
            ctx.roundRect(cx - eyeW / 2, cy - eyeH / 2, eyeW, eyeH, 16 * sx);
            ctx.fill();
            // Wide open pupil
            ctx.fillStyle = "#030a06";
            ctx.beginPath();
            ctx.arc(cx, cy, 7 * sx, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#38ef7d";
            return;
        }

        // 10. EXP_NEUTRAL (Default)
        const radius = Math.min(eyeW, eyeH) / 2;
        ctx.roundRect(cx - eyeW / 2, cy - eyeH / 2, eyeW, eyeH, radius);
        ctx.fill();
    }
}

// Start app on DOMContentLoaded
window.addEventListener("DOMContentLoaded", () => {
    window.robotApp = new VirtualRobotApp();
});
