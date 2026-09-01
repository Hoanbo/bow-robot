import { Logger, RobotExpression } from "@bow/shared";
export interface BowAgentQueryResponse {
    success: boolean;
    text: string;
    expression: RobotExpression;
    actions?: any[];
    desktopAction?: any;
    sessionId: string;
    timestamp: string;
}
export interface BowAgentClientConfig {
    url?: string;
    reconnectIntervalMs?: number;
    maxReconnectDelayMs?: number;
    timeoutMs?: number;
}
export declare class BowAgentClient {
    private readonly logger;
    private ws;
    private readonly url;
    private isConnected;
    private reconnectTimer;
    private currentDelay;
    private readonly baseDelay;
    private readonly maxDelay;
    private readonly timeoutMs;
    private pendingRequests;
    constructor(logger: Logger, config?: BowAgentClientConfig);
    connect(): Promise<void>;
    private scheduleReconnect;
    private handleIncomingMessage;
    query(userQuery: string, sessionId?: string, context?: Record<string, unknown>): Promise<BowAgentQueryResponse>;
    isGatewayConnected(): boolean;
    close(): void;
}
export default BowAgentClient;
//# sourceMappingURL=bowAgentClient.d.ts.map