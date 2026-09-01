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
    isSurprised?: boolean;
    isSleeping?: boolean;
    isThinking?: boolean;
}
export interface EyeRenderFrame {
    leftEye: EyeParams;
    rightEye: EyeParams;
    expression: RobotExpression;
    panTilt: ServoPosition;
    timestamp: number;
}
export declare class AnimatedEyesEngine {
    private currentExpression;
    private panTilt;
    private blinkProgress;
    private isBlinking;
    private nextBlinkTime;
    private thinkAngle;
    private speechPulse;
    constructor();
    setExpression(exp: RobotExpression): void;
    setPanTilt(pos: ServoPosition): void;
    /**
     * Compute next 128x64 frame parameters for the 2 eyes
     */
    update(dtMs: number): EyeRenderFrame;
}
export default AnimatedEyesEngine;
//# sourceMappingURL=eyes.d.ts.map