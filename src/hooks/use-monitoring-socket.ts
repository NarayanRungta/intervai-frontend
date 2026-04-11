"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getMonitoringWebSocketUrl, monitoringApi } from "@/src/lib/monitoring-api";
import type {
  MonitoringHealthState,
  MonitoringSnapshot,
  MonitoringSocketState,
  MonitoringViolation,
  MonitoringViolationCode,
  MonitoringViolationSeverity,
} from "@/src/types/monitoring";

const SOCKET_RECONNECT_BASE_MS = 1000;
const SOCKET_RECONNECT_MAX_MS = 10000;
const HEALTH_POLL_MS = 12000;
const STATUS_FALLBACK_POLL_MS = 3000;
const VIOLATION_COOLDOWN_MS = 7000;
const SCORE_RECOVERY_INTERVAL_MS = 15000;
const MAX_RECENT_VIOLATIONS = 20;
const CONNECTIVITY_FAILURE_THRESHOLD = 3;
const WARNING_ONLY_MODE = true;

type ViolationCandidate = {
  code: MonitoringViolationCode;
  severity: MonitoringViolationSeverity;
  message: string;
  scoreDelta: number;
  snapshot: MonitoringSnapshot | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function severityWeight(severity: MonitoringViolationSeverity) {
  if (severity === "critical") {
    return 4;
  }

  if (severity === "high") {
    return 3;
  }

  if (severity === "medium") {
    return 2;
  }

  return 1;
}

function isMonitoringSnapshot(input: unknown): input is MonitoringSnapshot {
  if (!input || typeof input !== "object") {
    return false;
  }

  const value = input as Partial<MonitoringSnapshot>;

  if (typeof value.timestamp !== "string") {
    return false;
  }

  if (typeof value.eye !== "string" || typeof value.head !== "string") {
    return false;
  }

  if (typeof value.phone !== "boolean") {
    return false;
  }

  if (typeof value.suspicion_score !== "number") {
    return false;
  }

  if (!value.confidence || typeof value.confidence !== "object") {
    return false;
  }

  return true;
}

function buildSnapshotViolations(snapshot: MonitoringSnapshot): ViolationCandidate[] {
  const candidates: ViolationCandidate[] = [];

  if (snapshot.error) {
    candidates.push({
      code: "BACKEND_ERROR",
      severity: "critical",
      message: `Monitoring backend reported an error: ${snapshot.error}`,
      scoreDelta: 20,
      snapshot,
    });
  }

  if (snapshot.phone) {
    candidates.push({
      code: "PHONE_DETECTED",
      severity: "critical",
      message: "Phone detected in frame. Keep only interview materials visible.",
      scoreDelta: 18,
      snapshot,
    });
  }

  if (snapshot.eye !== "center") {
    candidates.push({
      code: "LOOKING_AWAY",
      severity: snapshot.eye === "unknown" ? "high" : "medium",
      message:
        snapshot.eye === "unknown"
          ? "Eye gaze is not confidently tracked. Face the camera clearly."
          : "Sustained eye deviation detected. Please focus on the screen.",
      scoreDelta: snapshot.eye === "unknown" ? 10 : 8,
      snapshot,
    });
  }

  if (snapshot.head !== "center") {
    candidates.push({
      code: "HEAD_TURNED",
      severity: snapshot.head === "unknown" ? "high" : "medium",
      message:
        snapshot.head === "unknown"
          ? "Head position is unclear. Re-center your face in frame."
          : "Head pose indicates prolonged turning. Stay centered.",
      scoreDelta: snapshot.head === "unknown" ? 10 : 7,
      snapshot,
    });
  }

  if (snapshot.suspicion_score >= 0.85) {
    candidates.push({
      code: "HIGH_SUSPICION",
      severity: "critical",
      message: "Critical suspicion score detected. Please follow interview integrity guidelines.",
      scoreDelta: 16,
      snapshot,
    });
  } else if (snapshot.suspicion_score >= 0.7) {
    candidates.push({
      code: "HIGH_SUSPICION",
      severity: "high",
      message: "High suspicion score detected. Keep eyes and head centered.",
      scoreDelta: 12,
      snapshot,
    });
  } else if (snapshot.suspicion_score >= 0.55) {
    candidates.push({
      code: "HIGH_SUSPICION",
      severity: "medium",
      message: "Moderate suspicion score rise detected. Please maintain consistent focus.",
      scoreDelta: 7,
      snapshot,
    });
  }

  return candidates;
}

function formatViolationMessage(code: MonitoringViolationCode) {
  if (code === "MONITORING_OFFLINE") {
    return "Monitoring service is unavailable. Your session is still active, but integrity tracking is degraded.";
  }

  if (code === "BACKEND_ERROR") {
    return "Monitoring backend returned an internal error signal.";
  }

  return "Monitoring violation detected.";
}

export function useMonitoringSocket(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;

  const [snapshot, setSnapshot] = useState<MonitoringSnapshot | null>(null);
  const [socketState, setSocketState] = useState<MonitoringSocketState>("connecting");
  const [healthState, setHealthState] = useState<MonitoringHealthState>("unknown");
  const [backendConnectivityError, setBackendConnectivityError] = useState<string | null>(null);
  const [integrityScore, setIntegrityScore] = useState(100);
  const [totalPenaltyPoints, setTotalPenaltyPoints] = useState(0);
  const [recentViolations, setRecentViolations] = useState<MonitoringViolation[]>([]);
  const [activeViolation, setActiveViolation] = useState<MonitoringViolation | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(SOCKET_RECONNECT_BASE_MS);
  const retryTimerRef = useRef<number | null>(null);
  const healthTimerRef = useRef<number | null>(null);
  const statusTimerRef = useRef<number | null>(null);
  const scoreTimerRef = useRef<number | null>(null);
  const disposedRef = useRef(false);
  const violationQueueRef = useRef<MonitoringViolation[]>([]);
  const lastViolationByCodeRef = useRef<Record<MonitoringViolationCode, number>>({} as Record<MonitoringViolationCode, number>);
  const lastViolationAtRef = useRef(0);
  const activeViolationRef = useRef<MonitoringViolation | null>(null);
  const connectivityFailuresRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    if (healthTimerRef.current !== null) {
      window.clearInterval(healthTimerRef.current);
      healthTimerRef.current = null;
    }

    if (statusTimerRef.current !== null) {
      window.clearInterval(statusTimerRef.current);
      statusTimerRef.current = null;
    }

    if (scoreTimerRef.current !== null) {
      window.clearInterval(scoreTimerRef.current);
      scoreTimerRef.current = null;
    }
  }, []);

  const markConnectivitySuccess = useCallback(() => {
    connectivityFailuresRef.current = 0;
    setBackendConnectivityError(null);
  }, []);

  const markConnectivityFailure = useCallback((reason: string) => {
    connectivityFailuresRef.current += 1;
    if (connectivityFailuresRef.current >= CONNECTIVITY_FAILURE_THRESHOLD) {
      setBackendConnectivityError(reason);
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      return;
    }

    disposedRef.current = true;
    clearTimers();
    wsRef.current?.close();
    wsRef.current = null;

    connectivityFailuresRef.current = 0;
    lastViolationAtRef.current = 0;
    lastViolationByCodeRef.current = {} as Record<MonitoringViolationCode, number>;

    violationQueueRef.current = [];
    activeViolationRef.current = null;
  }, [clearTimers, enabled]);

  useEffect(() => {
    activeViolationRef.current = activeViolation;
  }, [activeViolation]);

  const pushViolation = useCallback((candidate: ViolationCandidate) => {
    const now = Date.now();
    const previousTime = lastViolationByCodeRef.current[candidate.code] ?? 0;
    if (now - previousTime < VIOLATION_COOLDOWN_MS) {
      return;
    }

    lastViolationByCodeRef.current[candidate.code] = now;
    lastViolationAtRef.current = now;

    const appliedScoreDelta = WARNING_ONLY_MODE ? 0 : candidate.scoreDelta;

    const violation: MonitoringViolation = {
      id: `${candidate.code}-${now}`,
      code: candidate.code,
      severity: candidate.severity,
      message: candidate.message,
      scoreDelta: appliedScoreDelta,
      at: new Date(now).toISOString(),
      snapshot: candidate.snapshot,
    };

    if (appliedScoreDelta > 0) {
      setIntegrityScore((current) => clamp(current - appliedScoreDelta, 0, 100));
      setTotalPenaltyPoints((current) => current + appliedScoreDelta);
    }

    setRecentViolations((current) => [violation, ...current].slice(0, MAX_RECENT_VIOLATIONS));

    if (!activeViolationRef.current) {
      activeViolationRef.current = violation;
      setActiveViolation(violation);
      return;
    }

    violationQueueRef.current.push(violation);
  }, []);

  const dismissActiveViolation = useCallback(() => {
    const nextViolation = violationQueueRef.current.shift() ?? null;
    activeViolationRef.current = nextViolation;
    setActiveViolation(nextViolation);
  }, []);

  const processSnapshot = useCallback(
    (nextSnapshot: MonitoringSnapshot) => {
      setSnapshot(nextSnapshot);

      const candidates = buildSnapshotViolations(nextSnapshot);
      if (candidates.length === 0) {
        return;
      }

      const selected = [...candidates].sort((left, right) => {
        if (right.scoreDelta !== left.scoreDelta) {
          return right.scoreDelta - left.scoreDelta;
        }

        return severityWeight(right.severity) - severityWeight(left.severity);
      })[0];

      if (selected) {
        pushViolation(selected);
      }
    },
    [pushViolation],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    disposedRef.current = false;

    const connect = () => {
      if (disposedRef.current) {
        return;
      }

      setSocketState("connecting");
      const ws = new WebSocket(getMonitoringWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        setSocketState("open");
        setHealthState("ok");
        reconnectDelayRef.current = SOCKET_RECONNECT_BASE_MS;
        markConnectivitySuccess();
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as unknown;
          if (!isMonitoringSnapshot(parsed)) {
            setSocketState("error");
            pushViolation({
              code: "BACKEND_ERROR",
              severity: "high",
              message: "Monitoring stream payload is invalid.",
              scoreDelta: 10,
              snapshot: null,
            });
            return;
          }

          markConnectivitySuccess();
          processSnapshot(parsed);
        } catch {
          setSocketState("error");
          pushViolation({
            code: "BACKEND_ERROR",
            severity: "high",
            message: "Monitoring stream payload failed to parse.",
            scoreDelta: 10,
            snapshot: null,
          });
          markConnectivityFailure("Monitoring backend is not reachable. Please ensure the backend is running.");
        }
      };

      ws.onerror = () => {
        if (disposedRef.current) {
          return;
        }

        setSocketState("error");
        markConnectivityFailure("Monitoring backend is not reachable. Please ensure the backend is running.");
      };

      ws.onclose = () => {
        if (disposedRef.current) {
          return;
        }

        setSocketState("closed");
        markConnectivityFailure("Monitoring backend is not reachable. Please ensure the backend is running.");

        const delay = reconnectDelayRef.current;
        retryTimerRef.current = window.setTimeout(connect, delay);
        reconnectDelayRef.current = Math.min(delay * 2, SOCKET_RECONNECT_MAX_MS);
      };
    };

    connect();

    return () => {
      disposedRef.current = true;
      clearTimers();
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [clearTimers, enabled, markConnectivityFailure, markConnectivitySuccess, processSnapshot, pushViolation]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const pollHealth = async () => {
      try {
        const health = await monitoringApi.getHealth();

        if (health.status === "ok" && health.monitoring_running) {
          setHealthState("ok");
          markConnectivitySuccess();
          return;
        }

        setHealthState("degraded");
        pushViolation({
          code: "MONITORING_OFFLINE",
          severity: "high",
          message: health.last_error
            ? `Monitoring service degraded: ${health.last_error}`
            : formatViolationMessage("MONITORING_OFFLINE"),
          scoreDelta: 8,
          snapshot: null,
        });
        markConnectivityFailure(
          health.last_error
            ? `Monitoring backend is not reachable: ${health.last_error}`
            : "Monitoring backend is not reachable. Please ensure the backend is running.",
        );
      } catch {
        setHealthState("offline");
        pushViolation({
          code: "MONITORING_OFFLINE",
          severity: "critical",
          message: formatViolationMessage("MONITORING_OFFLINE"),
          scoreDelta: 12,
          snapshot: null,
        });
        markConnectivityFailure("Monitoring backend is not reachable. Please ensure the backend is running.");
      }
    };

    void pollHealth();
    healthTimerRef.current = window.setInterval(() => {
      void pollHealth();
    }, HEALTH_POLL_MS);

    return () => {
      if (healthTimerRef.current !== null) {
        window.clearInterval(healthTimerRef.current);
      }
    };
  }, [enabled, markConnectivityFailure, markConnectivitySuccess, pushViolation]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (socketState === "open") {
      if (statusTimerRef.current !== null) {
        window.clearInterval(statusTimerRef.current);
      }
      return;
    }

    const pollStatus = async () => {
      try {
        const statusSnapshot = await monitoringApi.getStatus();
        markConnectivitySuccess();
        processSnapshot(statusSnapshot);
      } catch {
        setHealthState((current) => (current === "offline" ? current : "degraded"));
        markConnectivityFailure("Monitoring backend is not reachable. Please ensure the backend is running.");
      }
    };

    void pollStatus();
    statusTimerRef.current = window.setInterval(() => {
      void pollStatus();
    }, STATUS_FALLBACK_POLL_MS);

    return () => {
      if (statusTimerRef.current !== null) {
        window.clearInterval(statusTimerRef.current);
      }
    };
  }, [enabled, markConnectivityFailure, markConnectivitySuccess, processSnapshot, socketState]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    scoreTimerRef.current = window.setInterval(() => {
      if (Date.now() - lastViolationAtRef.current < SCORE_RECOVERY_INTERVAL_MS) {
        return;
      }

      setIntegrityScore((current) => Math.min(100, current + 2));
    }, SCORE_RECOVERY_INTERVAL_MS);

    return () => {
      if (scoreTimerRef.current !== null) {
        window.clearInterval(scoreTimerRef.current);
      }
    };
  }, [enabled]);

  const riskScore = useMemo(() => {
    const suspicionFactor = Math.round((snapshot?.suspicion_score ?? 0) * 100);
    const integrityRisk = 100 - integrityScore;
    return clamp(Math.round(integrityRisk * 0.65 + suspicionFactor * 0.35), 0, 100);
  }, [integrityScore, snapshot?.suspicion_score]);

  const resolvedSnapshot = enabled ? snapshot : null;
  const resolvedSocketState: MonitoringSocketState = enabled ? socketState : "closed";
  const resolvedHealthState: MonitoringHealthState = enabled ? healthState : "unknown";
  const resolvedBackendConnectivityError = enabled ? backendConnectivityError : null;
  const resolvedIntegrityScore = enabled ? integrityScore : 100;
  const resolvedRiskScore = enabled ? riskScore : 0;
  const resolvedTotalPenaltyPoints = enabled ? totalPenaltyPoints : 0;
  const resolvedRecentViolations = enabled ? recentViolations : [];
  const resolvedActiveViolation = enabled ? activeViolation : null;

  return {
    snapshot: resolvedSnapshot,
    socketState: resolvedSocketState,
    healthState: resolvedHealthState,
    backendConnectivityError: resolvedBackendConnectivityError,
    integrityScore: resolvedIntegrityScore,
    riskScore: resolvedRiskScore,
    totalPenaltyPoints: resolvedTotalPenaltyPoints,
    recentViolations: resolvedRecentViolations,
    activeViolation: resolvedActiveViolation,
    dismissActiveViolation,
  };
}
