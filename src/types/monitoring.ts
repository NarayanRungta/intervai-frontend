export type EyeDirection = "center" | "left" | "right" | "down" | "unknown";

export type HeadDirection =
  | "center"
  | "left"
  | "right"
  | "up"
  | "down"
  | "unknown";

export type ConfidenceBreakdown = {
  eye: number;
  head: number;
  phone: number;
};

export type MonitoringSnapshot = {
  timestamp: string;
  eye: EyeDirection;
  head: HeadDirection;
  phone: boolean;
  confidence: ConfidenceBreakdown;
  suspicion_score: number;
  yaw: number | null;
  pitch: number | null;
  error: string | null;
};

export type HealthResponse = {
  status: "ok" | "degraded";
  monitoring_running: boolean;
  last_error: string | null;
  timestamp: string;
};

export type MonitoringViolationCode =
  | "PHONE_DETECTED"
  | "LOOKING_AWAY"
  | "HEAD_TURNED"
  | "HIGH_SUSPICION"
  | "BACKEND_ERROR"
  | "MONITORING_OFFLINE";

export type MonitoringViolationSeverity = "low" | "medium" | "high" | "critical";

export type MonitoringViolation = {
  id: string;
  code: MonitoringViolationCode;
  severity: MonitoringViolationSeverity;
  message: string;
  scoreDelta: number;
  at: string;
  snapshot: MonitoringSnapshot | null;
};

export type MonitoringSocketState = "connecting" | "open" | "closed" | "error";

export type MonitoringHealthState = "unknown" | "ok" | "degraded" | "offline";
