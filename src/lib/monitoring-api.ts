import type { HealthResponse, MonitoringSnapshot } from "@/src/types/monitoring";

const API_BASE = process.env.NEXT_PUBLIC_MONITORING_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8001";

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Monitoring API request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export const monitoringApi = {
  getHealth: () => requestJson<HealthResponse>("/health"),
  getStatus: () => requestJson<MonitoringSnapshot>("/status"),
};

export function getMonitoringWebSocketUrl() {
  return process.env.NEXT_PUBLIC_MONITORING_WS_URL ?? process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8001/ws/monitor";
}
