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

export default function Home() {
  const [missingImage, setMissingImage] = useState<File | null>(null);
  const [cam1, setCam1] = useState<File | null>(null);
  const [cam2, setCam2] = useState<File | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [status, setStatus] = useState<SystemStatus>("booting");
  const [lastChecked, setLastChecked] = useState<string>("");

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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_28%),linear-gradient(180deg,#111111_0%,#0a0a0a_55%,#050505_100%)] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="border-b border-white/15 pb-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.35em] text-white/70">
                Missing Person Search Platform
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
                  AI Surveillance Command Center
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
                  Black and white operator dashboard for live missing-person analysis.
                  Upload a reference photo and camera feeds, then watch person-only detections,
                  FaceNet matching, and evidence export from one control surface.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[36rem]">
              <StatusCard label="Backend" value={status === "online" ? "Online" : status === "offline" ? "Offline" : "Booting"} tone={status === "online" ? "good" : status === "offline" ? "bad" : "neutral"} />
              <StatusCard label="Session" value={sessionId ? sessionId.slice(0, 8) : "Idle"} tone={sessionId ? "good" : "neutral"} />
              <StatusCard label="Last check" value={lastChecked || "--:--:--"} tone="neutral" />
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-6 xl:grid-cols-[420px_1fr]">
          <aside className="space-y-6">
            <Panel title="Mission Inputs" subtitle="Everything the operator needs to start a run.">
              <UploadField
                label="Missing person image"
                hint="Clear frontal face image for embedding extraction."
                accept="image/*"
                onChange={(event) => setMissingImage(event.target.files?.[0] ?? null)}
              />
              <UploadField
                label="Camera feed 1"
                hint="Video file or recorded stream for CAM-1."
                accept="video/*"
                onChange={(event) => setCam1(event.target.files?.[0] ?? null)}
              />
              <UploadField
                label="Camera feed 2"
                hint="Video file or recorded stream for CAM-2."
                accept="video/*"
                onChange={(event) => setCam2(event.target.files?.[0] ?? null)}
              />

              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleRunAnalysis}
                  disabled={!readyToRun}
                  className="rounded-2xl border border-white bg-white px-4 py-3 text-sm font-bold text-black transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:border-white/15 disabled:bg-white/10 disabled:text-white/40"
                >
                  {loading ? "Launching analysis..." : sessionId ? "Analysis running" : "Start analysis"}
                </button>
                <button
                  type="button"
                  onClick={resetSession}
                  className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Reset session
                </button>
              </div>

              {error ? (
                <div className="mt-4 rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/80">
                  {error}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/60">
                  Ready when all three files are loaded.
                </div>
              )}

              {backendError && (
                <div className="mt-3 rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/80">
                  {backendError}
                </div>
              )}
            </Panel>

            <Panel title="Operator Workflow" subtitle="Use the system in three steps.">
              <ol className="space-y-3 text-sm text-white/75">
                <li className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <span className="font-bold text-white">01</span>
                  <span>Load the reference image for the missing person.</span>
                </li>
                <li className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <span className="font-bold text-white">02</span>
                  <span>Upload both camera feeds to create the live search session.</span>
                </li>
                <li className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <span className="font-bold text-white">03</span>
                  <span>Watch alerts, open the streams, and export the evidence report.</span>
                </li>
              </ol>
            </Panel>

            <Panel title="System Intelligence" subtitle="Tuning and model details.">
              <div className="grid gap-3 text-sm text-white/75">
                <InfoRow label="Detector" value="YOLOv12-nano / person-only" />
                <InfoRow label="Embedding model" value="FaceNet512" />
                <InfoRow label="Match threshold" value="0.85 similarity" />
                <InfoRow label="Acceleration" value="CUDA / TensorRT / OpenVINO-ready" />
                <InfoRow label="Evidence" value="Snapshots + timestamps" />
              </div>
            </Panel>
          </aside>

          <div className="space-y-6">
            <Panel
              title="Live Surveillance Feeds"
              subtitle="Video streams are served directly from the backend session."
              action={
                <div className="text-xs uppercase tracking-[0.3em] text-white/45">
                  {sessionId ? `Session ${sessionId.slice(0, 8)}` : "Waiting for session"}
                </div>
              }
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <StreamCard title="CAM-1 Live Feed" sessionId={sessionId} streamUrl={streamUrl("CAM-1")} backendUrl={BACKEND_URL} />
                <StreamCard title="CAM-2 Live Feed" sessionId={sessionId} streamUrl={streamUrl("CAM-2")} backendUrl={BACKEND_URL} />
              </div>
            </Panel>

            <Panel
              title="Match Alerts"
              subtitle="High-confidence matches are appended here in real time."
              action={
                <button
                  type="button"
                  onClick={handleExportEvidence}
                  disabled={alerts.length === 0}
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-white/30"
                >
                  Export evidence
                </button>
              }
            >
              {alerts.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center text-sm text-white/55">
                  {sessionId
                    ? "Scanning for person candidates and waiting for a threshold match."
                    : "No active session yet. Start analysis to populate alerts."}
                </div>
              ) : (
                <div className="overflow-hidden rounded-3xl border border-white/10">
                  <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                    <thead className="bg-white/5 text-white/60">
                      <tr>
                        <th className="px-5 py-4 font-medium">Camera</th>
                        <th className="px-5 py-4 font-medium">Timestamp</th>
                        <th className="px-5 py-4 font-medium">Video time</th>
                        <th className="px-5 py-4 font-medium text-right">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 bg-black/20">
                      {alerts.map((alert, index) => (
                        <tr key={`${alert.timestamp}-${index}`} className="transition hover:bg-white/5">
                          <td className="px-5 py-4 font-semibold text-white">{alert.camera}</td>
                          <td className="px-5 py-4 text-white/65">{alert.timestamp}</td>
                          <td className="px-5 py-4 text-white/65">{formatTime(alert.video_timestamp)}</td>
                          <td className="px-5 py-4 text-right font-bold text-white">
                            {formatPercent(alert.score)}
                          </td>
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
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-white">{title}</h2>
          <p className="mt-1 text-sm text-white/55">{subtitle}</p>
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
    good: "border-white bg-white text-black",
    bad: "border-white/20 bg-black text-white",
    neutral: "border-white/10 bg-white/5 text-white",
  }[tone];

  return (
    <div className={`rounded-3xl border p-4 ${toneClasses}`}>
      <p className="text-[11px] uppercase tracking-[0.3em] text-current/55">{label}</p>
      <p className="mt-2 text-sm font-bold">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <span className="text-white/55">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

function UploadField({
  label,
  hint,
  accept,
  onChange,
}: {
  label: string;
  hint: string;
  accept: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="block rounded-3xl border border-dashed border-white/15 bg-black/30 p-4 transition hover:border-white/30 hover:bg-black/40">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">{label}</p>
          <p className="mt-1 text-xs leading-5 text-white/50">{hint}</p>
        </div>
        <span className="rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-white/50">
          Upload
        </span>
      </div>
      <input
        type="file"
        accept={accept}
        onChange={onChange}
        className="block w-full text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-bold file:text-black hover:file:bg-white/90"
      />
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
    <div className="space-y-3 rounded-3xl border border-white/10 bg-black/30 p-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <span className="text-[10px] uppercase tracking-[0.25em] text-white/45">{sessionId ? "Streaming" : "Idle"}</span>
      </div>
      <div className="relative aspect-video overflow-hidden rounded-[1.5rem] border border-white/10 bg-black">
        {sessionId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={streamUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-white/55">
            <div className="h-12 w-12 rounded-full border border-white/20 bg-white/5" />
            <div>
              <p className="text-sm font-semibold text-white/75">Backend online?</p>
              <p className="text-xs">{backendUrl}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
