"use client";

import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type AlertItem = {
  camera: string;
  timestamp: string;
  video_timestamp?: string;
  score: number;
  euclidean_distance?: number;
  snapshot?: string;
};

type SystemStatus = "booting" | "online" | "offline";

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8001").replace(/\/+$/, "");
const API_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function formatPercent(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

function formatTime(value?: string) {
  if (!value) return "--:--:--";
  return value;
}

function truncateSession(value: string | null) {
  if (!value) return "Idle";
  return `${value.slice(0, 8)}...`;
}

export default function Home() {
  const [missingImage, setMissingImage] = useState<File | null>(null);
  const [cam1, setCam1] = useState<File | null>(null);
  const [cam2, setCam2] = useState<File | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [resetInfo, setResetInfo] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [status, setStatus] = useState<SystemStatus>("booting");
  const [lastChecked, setLastChecked] = useState<string>("");
  const [uploadKey, setUploadKey] = useState(0);

  const readyToRun = useMemo(
    () => Boolean(missingImage && cam1 && cam2 && !loading),
    [missingImage, cam1, cam2, loading],
  );

  useEffect(() => {
    let mounted = true;

    const checkHealth = async () => {
      try {
        const response = await fetchWithTimeout(`${BACKEND_URL}/health`);
        if (!mounted) return;
        if (response.ok) {
          const data = await response.json();
          setStatus(data.status === "Online" ? "online" : "offline");
          setBackendError(null);
        } else {
          setStatus("offline");
          setBackendError("Backend health check failed. Confirm the API is running on port 8001.");
        }
      } catch {
        if (mounted) {
          setStatus("offline");
          setBackendError("Cannot reach backend. Start the backend service and retry.");
        }
      } finally {
        if (mounted) setLastChecked(new Date().toLocaleTimeString());
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const pollAlerts = async () => {
      try {
        const response = await fetchWithTimeout(`${BACKEND_URL}/api/alerts/${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
          setBackendError(null);
          setStatus("online");
        } else {
          setBackendError("Alert endpoint returned an error response.");
        }
      } catch {
        setStatus("offline");
        setBackendError("Live alert polling lost connection to backend.");
      }
    };

    pollAlerts();
    const interval = setInterval(pollAlerts, 1000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const resetSession = () => {
    setSessionId(null);
    setAlerts([]);
    setError(null);
    setBackendError(null);
    setResetInfo(null);
  };

  const handleResetPlatform = async () => {
    setResetting(true);
    setError(null);
    setResetInfo(null);

    try {
      const response = await fetchWithTimeout(`${BACKEND_URL}/api/system/reset-workspace`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ session_id: sessionId, prune_outputs: true }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || "Reset operation failed.");
      }

      resetSession();
      setMissingImage(null);
      setCam1(null);
      setCam2(null);
      setUploadKey((value) => value + 1);
      setResetInfo("Platform reset completed. Temporary files were cleaned and session state was cleared.");
      setStatus("online");
    } catch (resetError) {
      setStatus("offline");
      setError(resetError instanceof Error ? resetError.message : "Failed to reset platform.");
    } finally {
      setResetting(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (!missingImage || !cam1 || !cam2) {
      setError("Upload the missing person image plus both camera feeds before starting.");
      return;
    }

    setLoading(true);
    setError(null);
    setAlerts([]);

    const formData = new FormData();
    formData.append("missing_image", missingImage);
    formData.append("cam1_video", cam1);
    formData.append("cam2_video", cam2);

    try {
      const response = await fetch(`${BACKEND_URL}/api/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || "The backend could not start the analysis.");
      }

      const data = await response.json();
      setSessionId(data.session_id);
      setBackendError(null);
      setStatus("online");
    } catch (runError) {
      setStatus("offline");
      setError(runError instanceof Error ? runError.message : "Unexpected frontend error.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportEvidence = () => {
    const content = [
      "AI Surveillance Evidence Report",
      "================================",
      `Session: ${sessionId ?? "N/A"}`,
      `Generated: ${new Date().toLocaleString()}`,
      "",
      ...alerts.map(
        (alert) =>
          `[${alert.timestamp}] ${alert.camera} | video=${formatTime(alert.video_timestamp)} | score=${formatPercent(alert.score)} | euclidean=${alert.euclidean_distance?.toFixed(3) ?? "--"} | snapshot=${alert.snapshot ?? "--"}`,
      ),
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `surveillance_evidence_${sessionId?.slice(0, 8) ?? "session"}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const streamUrl = (camera: "CAM-1" | "CAM-2") => `${BACKEND_URL}/api/stream/${sessionId}/${camera}`;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#f8fafc_0%,#eef2f7_46%,#e5ebf3_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">
                Missing Person Platform
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Surveillance Operations Console
              </h1>
              <p className="text-sm leading-6 text-slate-600 sm:text-base">
                Professional control panel for AI-powered missing-person detection with live feeds,
                alert intelligence, and evidence management.
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-[34rem]">
              <StatusCard
                label="Backend"
                value={status === "online" ? "Online" : status === "offline" ? "Offline" : "Booting"}
                tone={status === "online" ? "good" : status === "offline" ? "bad" : "neutral"}
              />
              <StatusCard label="Session" value={truncateSession(sessionId)} tone={sessionId ? "good" : "neutral"} />
              <StatusCard label="Last check" value={lastChecked || "--:--:--"} tone="neutral" />
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-6 xl:grid-cols-[390px_1fr]">
          <aside className="space-y-6">
            <Panel title="Mission Inputs" subtitle="Upload files and start or reset your operation.">
              <UploadField
                key={`missing-${uploadKey}`}
                label="Missing person image"
                hint="Use a clear, frontal face photo."
                accept="image/*"
                fileName={missingImage?.name}
                onChange={(event) => setMissingImage(event.target.files?.[0] ?? null)}
              />
              <UploadField
                key={`cam1-${uploadKey}`}
                label="Camera feed 1"
                hint="Video stream capture for CAM-1."
                accept="video/*"
                fileName={cam1?.name}
                onChange={(event) => setCam1(event.target.files?.[0] ?? null)}
              />
              <UploadField
                key={`cam2-${uploadKey}`}
                label="Camera feed 2"
                hint="Video stream capture for CAM-2."
                accept="video/*"
                fileName={cam2?.name}
                onChange={(event) => setCam2(event.target.files?.[0] ?? null)}
              />

              <div className="mt-2 grid gap-3">
                <button
                  type="button"
                  onClick={handleRunAnalysis}
                  disabled={!readyToRun}
                  className="rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500"
                >
                  {loading ? "Launching analysis..." : sessionId ? "Analysis running" : "Start analysis"}
                </button>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={resetSession}
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Reset session
                  </button>
                  <button
                    type="button"
                    onClick={handleResetPlatform}
                    disabled={resetting}
                    className="rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    {resetting ? "Resetting platform..." : "Reset platform"}
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Ready when all three files are loaded.
              </div>

              {error && (
                <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  {error}
                </div>
              )}

              {backendError && (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                  {backendError}
                </div>
              )}

              {resetInfo && (
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                  {resetInfo}
                </div>
              )}
            </Panel>

            <Panel title="System Intelligence" subtitle="Current model and runtime profile.">
              <div className="grid gap-3 text-sm text-slate-700">
                <InfoRow label="Detector" value="YOLOv12-nano / person-only" />
                <InfoRow label="Embedding" value="FaceNet512" />
                <InfoRow label="Similarity threshold" value="0.85" />
                <InfoRow label="Acceleration" value="CUDA, TensorRT, OpenVINO-ready" />
                <InfoRow label="Outputs" value="Alerts, snapshots, export report" />
              </div>
            </Panel>
          </aside>

          <div className="space-y-6">
            <Panel
              title="Live Surveillance Feeds"
              subtitle="Backend MJPEG streams for active session cameras."
              action={<div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{truncateSession(sessionId)}</div>}
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <StreamCard title="CAM-1 Live Feed" sessionId={sessionId} streamUrl={streamUrl("CAM-1")} backendUrl={BACKEND_URL} />
                <StreamCard title="CAM-2 Live Feed" sessionId={sessionId} streamUrl={streamUrl("CAM-2")} backendUrl={BACKEND_URL} />
              </div>
            </Panel>

            <Panel
              title="Match Alerts"
              subtitle="High-confidence matches are tracked in real time."
              action={
                <button
                  type="button"
                  onClick={handleExportEvidence}
                  disabled={alerts.length === 0}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  Export evidence
                </button>
              }
            >
              {alerts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
                  {sessionId
                    ? "Analyzing frames continuously and waiting for match events."
                    : "No active session. Start analysis to view alerts."}
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Camera</th>
                        <th className="px-5 py-3 font-semibold">Timestamp</th>
                        <th className="px-5 py-3 font-semibold">Video time</th>
                        <th className="px-5 py-3 text-right font-semibold">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {alerts.map((alert, index) => (
                        <tr key={`${alert.timestamp}-${index}`} className="transition hover:bg-slate-50">
                          <td className="px-5 py-3 font-semibold text-slate-800">{alert.camera}</td>
                          <td className="px-5 py-3 text-slate-600">{alert.timestamp}</td>
                          <td className="px-5 py-3 text-slate-600">{formatTime(alert.video_timestamp)}</td>
                          <td className="px-5 py-3 text-right font-semibold text-slate-800">{formatPercent(alert.score)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        </section>
      </div>
    </main>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_14px_34px_rgba(15,23,42,0.07)] backdrop-blur-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatusCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "bad" | "neutral";
}) {
  const toneClasses = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-700",
    bad: "border-rose-200 bg-rose-50 text-rose-700",
    neutral: "border-slate-200 bg-slate-100 text-slate-700",
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses}`}>
      <p className="text-[11px] uppercase tracking-[0.3em] text-current/55">{label}</p>
      <p className="mt-2 text-sm font-bold">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function UploadField({
  label,
  hint,
  accept,
  fileName,
  onChange,
}: {
  label: string;
  hint: string;
  accept: string;
  fileName?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="block rounded-2xl border border-dashed border-slate-300 bg-white p-4 transition hover:border-slate-400 hover:bg-slate-50">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>
        </div>
        <span className="rounded-full border border-slate-300 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-slate-500">
          Upload
        </span>
      </div>
      <input
        type="file"
        accept={accept}
        onChange={onChange}
        className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-700"
      />
      <p className="mt-3 truncate text-xs text-slate-500">{fileName ?? "No file selected"}</p>
    </label>
  );
}

function StreamCard({
  title,
  sessionId,
  streamUrl,
  backendUrl,
}: {
  title: string;
  sessionId: string | null;
  streamUrl: string;
  backendUrl: string;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <span className="text-[10px] uppercase tracking-[0.25em] text-slate-400">{sessionId ? "Streaming" : "Idle"}</span>
      </div>
      <div className="relative aspect-video overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
        {sessionId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={streamUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-slate-300">
            <div className="h-12 w-12 rounded-full border border-slate-500 bg-slate-700" />
            <div>
              <p className="text-sm font-semibold text-slate-200">Backend online?</p>
              <p className="text-xs">{backendUrl}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
