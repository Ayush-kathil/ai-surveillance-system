"use client";

import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useState } from "react";

type AlertItem = {
  camera: string;
  timestamp: string;
  video_timestamp?: string;
  score: number;
  euclidean_distance?: number;
  snapshot?: string;
};

type SystemStatus = "booting" | "online" | "offline";

type WorkflowStep = 0 | 1 | 2 | 3;

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8001").replace(/\/+$/, "");
const API_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
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

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return url;
}

export default function Home() {
  const [step, setStep] = useState<WorkflowStep>(0);
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

  const missingPreview = useObjectUrl(missingImage);
  const cam1Preview = useObjectUrl(cam1);
  const cam2Preview = useObjectUrl(cam2);

  const readyToRun = Boolean(missingImage && cam1 && cam2 && !loading);
  const uploadCount = [missingImage, cam1, cam2].filter(Boolean).length;
  const progress = getWorkflowProgress(step, status, loading, sessionId, alerts.length, uploadCount);

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
    const interval = window.setInterval(checkHealth, 5000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
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
    const interval = window.setInterval(pollAlerts, 1000);
    return () => window.clearInterval(interval);
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
      setStep(0);
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
      setStep(3);
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
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#ffffff_0%,#f7f7f7_44%,#ececec_100%)] text-black">
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[linear-gradient(180deg,rgba(0,0,0,0.06),rgba(255,255,255,0))]" />
        <div className="pointer-events-none absolute -left-24 top-32 -z-10 h-72 w-72 rounded-full border border-black/10 bg-white/60 blur-3xl animate-drift" />
        <div className="pointer-events-none absolute -right-28 top-10 -z-10 h-80 w-80 rounded-full border border-black/10 bg-black/[0.03] blur-3xl animate-drift-delayed" />

        <header className="rounded-[2rem] border border-black/10 bg-white/90 px-5 py-5 shadow-[0_22px_70px_rgba(0,0,0,0.08)] backdrop-blur-xl sm:px-7 sm:py-6 fade-in-up">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-white">
                Missing Person Surveillance System
              </div>
              <div className="space-y-4">
                <h1 className="max-w-4xl text-4xl font-black tracking-tight text-black sm:text-5xl lg:text-6xl">
                  Clean, guided surveillance workflow for reference-image matching.
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-black/70 sm:text-base">
                  Upload the missing-person photo, add two camera feeds, monitor the live detection session, and export a timestamped evidence report from a single professional interface.
                </p>
              </div>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-3 xl:max-w-[44rem]">
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

        <section className="mt-6 grid gap-6 xl:grid-cols-[300px_1fr]">
          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <Panel title="Workflow" subtitle="Move through the guided pages in order.">
              <div className="space-y-3">
                {WORKFLOW_STEPS.map((item, index) => {
                  const active = step === item.id;
                  const completed = step > item.id || (item.id === 3 && Boolean(sessionId));

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setStep(item.id)}
                      className={`flex w-full items-start gap-4 rounded-2xl border px-4 py-4 text-left transition duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:bg-black/[0.03] ${
                        active ? "border-black bg-black text-white shadow-[0_16px_30px_rgba(0,0,0,0.12)]" : "border-black/10 bg-white"
                      }`}
                    >
                      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${active ? "border-white bg-white text-black" : completed ? "border-black bg-black text-white" : "border-black/20 bg-black/[0.03] text-black/70"}`}>
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs uppercase tracking-[0.24em] text-current/55">
                          {item.kicker}
                        </span>
                        <span className="mt-1 block text-sm font-semibold leading-6">{item.title}</span>
                        <span className={`mt-1 block text-xs leading-5 ${active ? "text-white/70" : "text-black/55"}`}>
                          {item.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Panel>

            <Panel title="System Snapshot" subtitle="Monochrome operating profile and backend contract.">
              <div className="grid gap-3 text-sm text-black/75">
                <InfoRow label="Detector" value="YOLO person detection + FaceNet512" />
                <InfoRow label="Similarity" value="Cosine + Euclidean matching" />
                <InfoRow label="Threshold" value="0.85 match gate" />
                <InfoRow label="Outputs" value="Alerts, snapshots, export text" />
                <InfoRow label="API" value="/api/analyze, /api/alerts, /api/stream" />
              </div>
            </Panel>
          </aside>

          <div className="space-y-6">
            {step === 0 && (
              <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] fade-in-up">
                <Panel title="Welcome" subtitle="Start here, then move through the upload and review pages.">
                  <div className="space-y-5">
                    <p className="max-w-2xl text-sm leading-7 text-black/70">
                      This interface is designed like a single-purpose operations console. Each page focuses on one task, with hard-edged black-and-white controls, smooth transitions, and a live backend status signal.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        ["1", "Add the missing photo", "Preview the source image before uploading."],
                        ["2", "Add camera videos", "Confirm the footage for CAM-1 and CAM-2."],
                        ["3", "Run detection", "Watch live streams, alerts, and timestamps."],
                      ].map(([number, title, description]) => (
                        <div key={title} className="rounded-3xl border border-black/10 bg-black/[0.02] p-4">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-black bg-black text-xs font-bold text-white">
                              {number}
                            </span>
                            <p className="font-semibold text-black">{title}</p>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-black/60">{description}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition duration-300 hover:scale-[1.02] hover:bg-black/90"
                      >
                        Begin setup
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-semibold text-black transition duration-300 hover:border-black hover:bg-black/[0.02]"
                      >
                        Jump to review
                      </button>
                    </div>
                  </div>
                </Panel>

                <Panel title="Live System Health" subtitle="Backend visibility and runtime state.">
                  <div className="grid gap-4">
                    <HealthCard status={status} lastChecked={lastChecked} backendError={backendError} />
                    <div className="rounded-[1.5rem] border border-black/10 bg-black/[0.02] p-5">
                      <p className="text-xs uppercase tracking-[0.24em] text-black/45">Current session</p>
                      <p className="mt-2 text-3xl font-black tracking-tight text-black">{truncateSession(sessionId)}</p>
                      <p className="mt-2 text-sm leading-6 text-black/60">
                        {sessionId ? "A session is already running and alert polling is active." : "No session is running yet. Start the workflow to create one."}
                      </p>
                    </div>
                  </div>
                </Panel>
              </section>
            )}

            {step === 1 && (
              <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr] fade-in-up">
                <Panel
                  title="Missing Person Photo"
                  subtitle="Upload the reference image used by the backend matcher."
                  action={<BackendDot status={status} />}
                >
                  <div className="space-y-5">
                    <UploadField
                      key={`missing-${uploadKey}`}
                      label="Missing person image"
                      hint="Use a clear, frontal face photo with good lighting."
                      accept="image/*"
                      fileName={missingImage?.name}
                      onChange={(event) => setMissingImage(event.target.files?.[0] ?? null)}
                    />
                    <PreviewWindow
                      title="Photo preview"
                      subtitle={missingImage ? missingImage.name : "No photo selected yet"}
                    >
                      {missingPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={missingPreview} alt="Missing person preview" className="h-full w-full object-cover" />
                      ) : (
                        <PlaceholderVisual text="Missing person preview appears here" />
                      )}
                    </PreviewWindow>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setStep(0)}
                        className="rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-black/[0.03]"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        disabled={!missingImage}
                        className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:bg-black/20"
                      >
                        Continue to videos
                      </button>
                    </div>
                  </div>
                </Panel>

                <Panel title="Guidance" subtitle="What the backend expects from the photo stage.">
                  <div className="space-y-4 text-sm leading-7 text-black/70">
                    <InfoRow label="Required" value="One image file" />
                    <InfoRow label="Format" value="JPG, PNG, or WebP" />
                    <InfoRow label="Quality" value="Frontal face, minimal blur" />
                    <InfoRow label="Backend" value={status === "online" ? "Online" : "Offline"} />
                    <p className="rounded-3xl border border-black/10 bg-black/[0.02] p-5">
                      The green status dot reflects the backend health endpoint. If the dot is gray or red, verify the FastAPI server before uploading your evidence.
                    </p>
                  </div>
                </Panel>
              </section>
            )}

            {step === 2 && (
              <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr] fade-in-up">
                <Panel title="Camera Videos" subtitle="Upload both surveillance clips for the matching session.">
                  <div className="space-y-5">
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
                    <div className="grid gap-4 lg:grid-cols-2">
                      <PreviewWindow title="CAM-1 preview" subtitle={cam1 ? cam1.name : "No file selected"}>
                        {cam1Preview ? (
                          <video src={cam1Preview} controls className="h-full w-full object-cover" />
                        ) : (
                          <PlaceholderVisual text="CAM-1 video preview" />
                        )}
                      </PreviewWindow>
                      <PreviewWindow title="CAM-2 preview" subtitle={cam2 ? cam2.name : "No file selected"}>
                        {cam2Preview ? (
                          <video src={cam2Preview} controls className="h-full w-full object-cover" />
                        ) : (
                          <PlaceholderVisual text="CAM-2 video preview" />
                        )}
                      </PreviewWindow>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-black/[0.03]"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        disabled={!cam1 || !cam2}
                        className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:bg-black/20"
                      >
                        Continue to analysis
                      </button>
                    </div>
                  </div>
                </Panel>

                <Panel title="Detection Notes" subtitle="The backend streams only after a session starts.">
                  <div className="space-y-4 text-sm leading-7 text-black/70">
                    <InfoRow label="Required" value="Two video files" />
                    <InfoRow label="Formats" value="MP4, AVI, MOV, MKV" />
                    <InfoRow label="Camera labels" value="CAM-1 and CAM-2" />
                    <InfoRow label="Streaming" value="MJPEG live feed after start" />
                    <p className="rounded-3xl border border-black/10 bg-black/[0.02] p-5">
                      Keep the filenames clear and the camera order consistent. The backend uses both videos in the same session and reports matches by camera number and timestamp.
                    </p>
                  </div>
                </Panel>
              </section>
            )}

            {step === 3 && (
              <section className="space-y-6 fade-in-up">
                <Panel
                  title="Live Detection Dashboard"
                  subtitle="Missing person photo, camera streams, and alert progress in one place."
                  action={
                    <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-black/45">
                      <span className="h-2.5 w-2.5 rounded-full bg-black" />
                      {sessionId ? "Session active" : "Ready to start"}
                    </div>
                  }
                >
                  <div className="space-y-5">
                    <div className="rounded-[1.5rem] border border-black/10 bg-black/[0.02] p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.24em] text-black/45">Detection progress</p>
                          <p className="mt-2 text-3xl font-black tracking-tight text-black">{progress}%</p>
                          <p className="mt-2 text-sm leading-6 text-black/60">
                            Progress reflects the setup stage, active session state, and live alert activity from the backend.
                          </p>
                        </div>
                        <div className="w-full max-w-md">
                          <div className="h-3 overflow-hidden rounded-full border border-black/10 bg-white">
                            <div
                              className="h-full rounded-full bg-black transition-all duration-700 ease-out"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-black/45">
                            <span>Setup</span>
                            <span>Monitoring</span>
                            <span>Evidence</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
                      <div className="space-y-4">
                        <PreviewWindow title="Missing person photo" subtitle={missingImage?.name ?? "No image loaded"}>
                          {missingPreview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={missingPreview} alt="Missing person preview" className="h-full w-full object-cover" />
                          ) : (
                            <PlaceholderVisual text="Missing person preview" />
                          )}
                        </PreviewWindow>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                          <PreviewWindow title="CAM-1 live stream" subtitle={sessionId ? "Connected to backend" : "Waiting for session"}>
                            {sessionId ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={streamUrl("CAM-1")} alt="CAM-1 stream" className="h-full w-full object-cover" />
                            ) : (
                              <PlaceholderVisual text="Start analysis to view CAM-1" />
                            )}
                          </PreviewWindow>
                          <PreviewWindow title="CAM-2 live stream" subtitle={sessionId ? "Connected to backend" : "Waiting for session"}>
                            {sessionId ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={streamUrl("CAM-2")} alt="CAM-2 stream" className="h-full w-full object-cover" />
                            ) : (
                              <PlaceholderVisual text="Start analysis to view CAM-2" />
                            )}
                          </PreviewWindow>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="grid gap-4 lg:grid-cols-3">
                          <MetricCard label="Photo" value={missingImage ? "Loaded" : "Missing"} />
                          <MetricCard label="Cam videos" value={`${[cam1, cam2].filter(Boolean).length}/2`} />
                          <MetricCard label="Backend" value={status === "online" ? "Online" : "Offline"} />
                        </div>

                        <div className="rounded-[1.5rem] border border-black/10 bg-white p-5">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-xs uppercase tracking-[0.24em] text-black/45">Session controls</p>
                              <p className="mt-1 text-sm text-black/60">
                                Start the backend session, clear it, or export the evidence report.
                              </p>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <span className={`h-3 w-3 rounded-full ${status === "online" ? "bg-emerald-500" : status === "offline" ? "bg-rose-500" : "bg-zinc-400"}`} />
                              <span className="font-semibold text-black/70">{status === "online" ? "Backend online" : status === "offline" ? "Backend offline" : "Checking backend"}</span>
                            </div>
                          </div>

                          <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={handleRunAnalysis}
                              disabled={!readyToRun}
                              className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition duration-300 hover:scale-[1.01] hover:bg-black/90 disabled:cursor-not-allowed disabled:bg-black/20"
                            >
                              {loading ? "Launching analysis..." : sessionId ? "Analysis running" : "Start analysis"}
                            </button>
                            <button
                              type="button"
                              onClick={handleExportEvidence}
                              disabled={alerts.length === 0}
                              className="rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-semibold text-black transition duration-300 hover:border-black hover:bg-black/[0.02] disabled:cursor-not-allowed disabled:border-black/10 disabled:text-black/30"
                            >
                              Export evidence
                            </button>
                          </div>
                        </div>

                        {error && <Notice tone="error" message={error} />}
                        {backendError && <Notice tone="warning" message={backendError} />}
                        {resetInfo && <Notice tone="success" message={resetInfo} />}
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                      <Panel title="Action rail" subtitle="Use these controls to tidy the session and workspace.">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={resetSession}
                            className="rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-black/[0.03]"
                          >
                            Reset session
                          </button>
                          <button
                            type="button"
                            onClick={handleResetPlatform}
                            disabled={resetting}
                            className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:bg-black/20"
                          >
                            {resetting ? "Resetting platform..." : "Reset platform"}
                          </button>
                        </div>
                      </Panel>

                      <Panel title="Match alerts" subtitle="Camera number, timestamp, score, and snapshot file.">
                        {alerts.length === 0 ? (
                          <div className="rounded-[1.5rem] border border-dashed border-black/15 bg-black/[0.02] p-8 text-center text-sm text-black/55">
                            {sessionId ? "Analyzing frames continuously and waiting for match events." : "No active session. Start analysis to view alerts."}
                          </div>
                        ) : (
                          <div className="overflow-hidden rounded-[1.5rem] border border-black/10 bg-white">
                            <table className="min-w-full divide-y divide-black/10 text-left text-sm">
                              <thead className="bg-black/[0.03] text-black/65">
                                <tr>
                                  <th className="px-5 py-3 font-semibold">Camera</th>
                                  <th className="px-5 py-3 font-semibold">Timestamp</th>
                                  <th className="px-5 py-3 font-semibold">Video time</th>
                                  <th className="px-5 py-3 text-right font-semibold">Score</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-black/10 bg-white">
                                {alerts.map((alert, index) => (
                                  <tr key={`${alert.timestamp}-${index}`} className="transition duration-200 hover:bg-black/[0.02]">
                                    <td className="px-5 py-3 font-semibold text-black">{alert.camera}</td>
                                    <td className="px-5 py-3 text-black/65">{alert.timestamp}</td>
                                    <td className="px-5 py-3 text-black/65">{formatTime(alert.video_timestamp)}</td>
                                    <td className="px-5 py-3 text-right font-semibold text-black">{formatPercent(alert.score)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </Panel>
                    </div>
                  </div>
                </Panel>
              </section>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

const WORKFLOW_STEPS = [
  {
    id: 0 as const,
    kicker: "Welcome",
    title: "Open the console",
    description: "See the overview, backend health, and workflow map before uploading anything.",
  },
  {
    id: 1 as const,
    kicker: "Reference image",
    title: "Upload the missing person photo",
    description: "Preview the image and confirm the backend status dot beside the upload card.",
  },
  {
    id: 2 as const,
    kicker: "Camera feeds",
    title: "Upload CAM-1 and CAM-2 videos",
    description: "Review the local video previews before sending them to the backend.",
  },
  {
    id: 3 as const,
    kicker: "Live analysis",
    title: "Start detection and monitor alerts",
    description: "Watch streams, timestamps, progress, and exportable evidence in one view.",
  },
] satisfies readonly {
  id: WorkflowStep;
  kicker: string;
  title: string;
  description: string;
}[];

function getWorkflowProgress(
  step: WorkflowStep,
  status: SystemStatus,
  loading: boolean,
  sessionId: string | null,
  alertCount: number,
  uploadCount: number,
) {
  if (step === 0) return 12;
  if (step === 1) return 28 + uploadCount * 4;
  if (step === 2) return 55 + uploadCount * 5;
  if (!sessionId) return 72 + uploadCount * 3;
  if (loading) return 84;
  if (alertCount > 0) return 100;
  if (status === "offline") return 78;
  return 90;
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
    <section className="rounded-[2rem] border border-black/10 bg-white/90 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.06)] backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_55px_rgba(0,0,0,0.08)] sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-black">{title}</h2>
          <p className="mt-1 text-sm text-black/55">{subtitle}</p>
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
    good: "border-black bg-black text-white",
    bad: "border-black/20 bg-black/[0.04] text-black/70",
    neutral: "border-black/10 bg-white text-black",
  }[tone];

  return (
    <div className={`rounded-[1.5rem] border p-4 transition duration-300 ${toneClasses}`}>
      <p className="text-[11px] uppercase tracking-[0.3em] text-current/55">{label}</p>
      <p className="mt-2 text-sm font-bold">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-3">
      <span className="text-black/55">{label}</span>
      <span className="font-semibold text-black">{value}</span>
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
    <label className="block rounded-[1.5rem] border border-dashed border-black/15 bg-white p-4 transition duration-300 hover:border-black/30 hover:bg-black/[0.02]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-black">{label}</p>
          <p className="mt-1 text-xs leading-5 text-black/55">{hint}</p>
        </div>
        <span className="rounded-full border border-black/15 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-black/55">
          Upload
        </span>
      </div>
      <input
        type="file"
        accept={accept}
        onChange={onChange}
        className="block w-full text-sm text-black/70 file:mr-3 file:rounded-full file:border-0 file:bg-black file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-black/85"
      />
      <p className="mt-3 truncate text-xs text-black/50">{fileName ?? "No file selected"}</p>
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
    <div className="space-y-3 rounded-[1.5rem] border border-black/10 bg-black/[0.02] p-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-black">{title}</h3>
        <span className="text-[10px] uppercase tracking-[0.25em] text-black/45">{sessionId ? "Streaming" : "Idle"}</span>
      </div>
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-black/10 bg-white">
        {sessionId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={streamUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-black/40">
            <div className="h-12 w-12 rounded-full border border-black/20 bg-white" />
            <div>
              <p className="text-sm font-semibold text-black/70">Backend online?</p>
              <p className="text-xs">{backendUrl}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewWindow({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-black/10 bg-black/[0.02]">
      <div className="border-b border-black/10 px-4 py-3">
        <p className="text-sm font-semibold text-black">{title}</p>
        <p className="mt-1 text-xs text-black/50">{subtitle}</p>
      </div>
      <div className="relative aspect-video bg-white">{children}</div>
    </div>
  );
}

function PlaceholderVisual({ text }: { text: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[linear-gradient(135deg,rgba(0,0,0,0.04),rgba(255,255,255,0.8))] text-center text-black/45">
      <div className="h-14 w-14 rounded-full border border-black/15 bg-white shadow-inner" />
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-black/10 bg-black/[0.02] px-4 py-4 text-center">
      <p className="text-[11px] uppercase tracking-[0.28em] text-black/45">{label}</p>
      <p className="mt-2 text-lg font-black text-black">{value}</p>
    </div>
  );
}

function HealthCard({
  status,
  lastChecked,
  backendError,
}: {
  status: SystemStatus;
  lastChecked: string;
  backendError: string | null;
}) {
  const dotClass =
    status === "online" ? "bg-emerald-500" : status === "offline" ? "bg-rose-500" : "bg-zinc-400";

  return (
    <div className="rounded-[1.5rem] border border-black/10 bg-black/[0.02] p-5">
      <div className="flex items-center gap-3">
        <span className={`h-3 w-3 rounded-full ${dotClass}`} />
        <div>
          <p className="text-sm font-semibold text-black">{status === "online" ? "Backend online" : status === "offline" ? "Backend offline" : "Checking backend"}</p>
          <p className="text-xs text-black/50">Last checked at {lastChecked || "--:--:--"}</p>
        </div>
      </div>
      {backendError && <p className="mt-4 text-sm leading-6 text-black/65">{backendError}</p>}
    </div>
  );
}

function BackendDot({ status }: { status: SystemStatus }) {
  const dotClass =
    status === "online" ? "bg-emerald-500" : status === "offline" ? "bg-rose-500" : "bg-zinc-400";
  const label = status === "online" ? "Backend online" : status === "offline" ? "Backend offline" : "Checking backend";

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-xs font-semibold text-black/70">
      <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
      {label}
    </div>
  );
}

function Notice({ tone, message }: { tone: "error" | "warning" | "success"; message: string }) {
  const toneClasses = {
    error: "border-rose-200 bg-rose-50 text-rose-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  }[tone];

  return <div className={`rounded-[1.5rem] border px-4 py-4 text-sm leading-6 ${toneClasses}`}>{message}</div>;
}
