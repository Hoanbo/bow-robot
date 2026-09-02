import { RobotExpression, ServoPosition } from "@bow/shared";

export interface EyeParams {
    x: number;
    y: number;
    width: number;
    height: number;
    pupilX?: number;
    pupilY?: number;
    curve?: number;
    closedRatio?: number;
    isHappy?: boolean;
    isCurious?: boolean;
    isSurprised?: boolean;
    isSleeping?: boolean;
    isThinking?: boolean;
    isLove?: boolean;
    isMatrix?: boolean;
    isError?: boolean;
    isBatteryLow?: boolean;
}

export interface EyeRenderFrame {
    leftEye: EyeParams;
    rightEye: EyeParams;
    expression: RobotExpression;
    panTilt: ServoPosition;
    timestamp: number;
}

export class AnimatedEyesEngine {
    private currentExpression: RobotExpression = "neutral";
    private panTilt: ServoPosition = { pan: 0, tilt: 0 };
    private blinkProgress = 0; // 0 (open) to 1 (closed)
    private isBlinking = false;
    private nextBlinkTime = Date.now() + 2000;
    private thinkAngle = 0;
    private speechPulse = 0;
    private lovePulse = 0;
    private matrixTicks = 0;

    constructor() {}

    public setExpression(exp: RobotExpression): void {
        this.currentExpression = exp;
    }

    public setPanTilt(pos: ServoPosition): void {
        this.panTilt = pos;
    }

    /**
     * Compute next 128x64 frame parameters for the 2 eyes (10 Expressions)
     */
    public update(dtMs: number): EyeRenderFrame {
        const now = Date.now();

        // 1. Handle natural blinking (skip for non-blinking special modes)
        const skipBlink =
            this.currentExpression === "sleeping" ||
            this.currentExpression === "matrix" ||
            this.currentExpression === "error" ||
            this.currentExpression === "battery_low";

        if (!skipBlink) {
            if (!this.isBlinking && now >= this.nextBlinkTime) {
                this.isBlinking = true;
                this.blinkProgress = 0;
            }

            if (this.isBlinking) {
                this.blinkProgress += dtMs / 120; // 120ms blink duration
                if (this.blinkProgress >= 1) {
                    this.isBlinking = false;
                    this.blinkProgress = 0;
                    this.nextBlinkTime = now + 2500 + Math.random() * 3500; // Random 2.5s - 6s
                }
            }
        }

        // 2. Animation oscillators
        this.thinkAngle += (dtMs / 1000) * 3.5;
        this.speechPulse = (Math.sin(now / 100) + 1) / 2;
        this.lovePulse = Math.sin(now / 200) * 3;
        this.matrixTicks += dtMs;

        // 3. Base eye positions on 128x64 OLED
        // Left eye center: (40, 32), Right eye center: (88, 32)
        const baseWidth = 30;
        const baseHeight = 36;
        const panOffset = (this.panTilt.pan / 90) * 10;
        const tiltOffset = (this.panTilt.tilt / 45) * 6;

        let leftEye: EyeParams = {
            x: 40 + panOffset,
            y: 32 + tiltOffset,
            width: baseWidth,
            height: baseHeight,
            closedRatio: this.isBlinking ? (this.blinkProgress <= 0.5 ? this.blinkProgress * 2 : (1 - this.blinkProgress) * 2) : 0,
        };

        let rightEye: EyeParams = {
            x: 88 + panOffset,
            y: 32 + tiltOffset,
            width: baseWidth,
            height: baseHeight,
            closedRatio: leftEye.closedRatio,
        };

        // 4. Expression specific adjustments (10 Emotions)
        switch (this.currentExpression) {
            case "happy":
                leftEye.isHappy = true;
                rightEye.isHappy = true;
                leftEye.height = 24;
                rightEye.height = 24;
                leftEye.y -= 2 + Math.sin(now / 150) * 2;
                rightEye.y -= 2 + Math.sin(now / 150) * 2;
                break;

            case "curious":
                leftEye.isCurious = true;
                rightEye.isCurious = true;
                leftEye.width = 36;
                leftEye.height = 40;
                leftEye.y -= 4; // Left eye raised inquisitively
                rightEye.width = 26;
                rightEye.height = 22;
                rightEye.y += 2;
                break;

            case "thinking":
                leftEye.isThinking = true;
                rightEye.isThinking = true;
                leftEye.height = 26;
                rightEye.height = 26;
                leftEye.pupilX = Math.cos(this.thinkAngle) * 6;
                leftEye.pupilY = Math.sin(this.thinkAngle) * 6;
                rightEye.pupilX = Math.cos(this.thinkAngle) * 6;
                rightEye.pupilY = Math.sin(this.thinkAngle) * 6;
                break;

            case "listening":
                leftEye.width = 34;
                leftEye.height = 40;
                rightEye.width = 34;
                rightEye.height = 40;
                leftEye.pupilY = 1;
                rightEye.pupilY = 1;
                break;

            case "speaking": {
                const osc = Math.sin(now / 110) * 8;
                leftEye.height = Math.max(18, baseHeight + osc);
                rightEye.height = Math.max(18, baseHeight + osc);
                break;
            }

            case "love":
                leftEye.isLove = true;
                rightEye.isLove = true;
                leftEye.width = 32 + this.lovePulse;
                leftEye.height = 32 + this.lovePulse;
                rightEye.width = 32 + this.lovePulse;
                rightEye.height = 32 + this.lovePulse;
                break;

            case "matrix":
                leftEye.isMatrix = true;
                rightEye.isMatrix = true;
                leftEye.width = 36;
                leftEye.height = 36;
                rightEye.width = 36;
                rightEye.height = 36;
                break;

            case "error":
                leftEye.isError = true;
                rightEye.isError = true;
                leftEye.height = 24;
                rightEye.height = 24;
                break;

            case "battery_low":
                leftEye.isBatteryLow = true;
                rightEye.isBatteryLow = true;
                leftEye.height = 16;
                rightEye.height = 16;
                leftEye.y += 6;
                rightEye.y += 6;
                break;

            case "sleeping":
                leftEye.isSleeping = true;
                rightEye.isSleeping = true;
                leftEye.closedRatio = 0.95;
                rightEye.closedRatio = 0.95;
                leftEye.height = 8;
                rightEye.height = 8;
                leftEye.y += Math.sin(now / 800) * 2;
                rightEye.y += Math.sin(now / 800) * 2;
                break;

            case "surprised":
                leftEye.isSurprised = true;
                rightEye.isSurprised = true;
                leftEye.width = 36;
                leftEye.height = 44;
                rightEye.width = 36;
                rightEye.height = 44;
                break;

            case "neutral":
            default:
                break;
        }

        return {
            leftEye,
            rightEye,
            expression: this.currentExpression,
            panTilt: this.panTilt,
            timestamp: now,
        };
    }
}

export default AnimatedEyesEngine;
