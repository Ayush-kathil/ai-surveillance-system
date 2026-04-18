"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";

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

type WorkflowState = {
  step: WorkflowStep;
  setStep: (step: WorkflowStep) => void;
  missingImage: File | null;
  setMissingImage: (file: File | null) => void;
  cam1: File | null;
  setCam1: (file: File | null) => void;
  cam2: File | null;
  setCam2: (file: File | null) => void;
  sessionId: string | null;
  setSessionId: (value: string | null) => void;
  alerts: AlertItem[];
  setAlerts: (value: AlertItem[]) => void;
  loading: boolean;
  setLoading: (value: boolean) => void;
  error: string | null;
  setError: (value: string | null) => void;
  backendError: string | null;
  setBackendError: (value: string | null) => void;
  resetInfo: string | null;
  setResetInfo: (value: string | null) => void;
  resetting: boolean;
  setResetting: (value: boolean) => void;
  status: SystemStatus;
  setStatus: (value: SystemStatus) => void;
  lastChecked: string;
  setLastChecked: (value: string) => void;
  uploadKey: number;
  bumpUploadKey: () => void;
  readyToRun: boolean;
  uploadCount: number;
  progress: number;
  missingPreview: string | null;
  cam1Preview: string | null;
  cam2Preview: string | null;
  resetSession: () => void;
  handleRunAnalysis: () => Promise<void>;
  handleResetPlatform: () => Promise<void>;
  handleExportEvidence: () => Promise<void>;
  streamUrl: (camera: "CAM-1" | "CAM-2") => string;
  snapshotUrl: (filename: string) => string;
};

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8001").replace(/\/+$/, "");
const API_TIMEOUT_MS = 8000;

const WorkflowContext = createContext<WorkflowState | null>(null);

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

function formatTime(value?: string) {
  if (!value) return "--:--:--";
  return value;
}

function formatPercent(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

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

export function WorkflowProvider({ children }: { children: ReactNode }) {
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

  const handleExportEvidence = async () => {
    const snapshotEntries = await Promise.all(
      alerts.map(async (alert) => {
        if (!sessionId || !alert.snapshot) {
          return { ...alert, snapshotDataUrl: null as string | null };
        }

        try {
          const response = await fetch(`${BACKEND_URL}/api/snapshots/${sessionId}/${encodeURIComponent(alert.snapshot)}`);
          if (!response.ok) {
            return { ...alert, snapshotDataUrl: null as string | null };
          }

          const blob = await response.blob();
          return {
            ...alert,
            snapshotDataUrl: await blobToDataUrl(blob),
          };
        } catch {
          return { ...alert, snapshotDataUrl: null as string | null };
        }
      }),
    );

    const html = buildEvidenceReport({
      sessionId,
      alerts: snapshotEntries,
      backendUrl: BACKEND_URL,
    });

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `surveillance_evidence_${sessionId?.slice(0, 8) ?? "session"}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const streamUrl = (camera: "CAM-1" | "CAM-2") => `${BACKEND_URL}/api/stream/${sessionId}/${camera}`;

  const value: WorkflowState = {
    step,
    setStep,
    missingImage,
    setMissingImage,
    cam1,
    setCam1,
    cam2,
    setCam2,
    sessionId,
    setSessionId,
    alerts,
    setAlerts,
    loading,
    setLoading,
    error,
    setError,
    backendError,
    setBackendError,
    resetInfo,
    setResetInfo,
    resetting,
    setResetting,
    status,
    setStatus,
    lastChecked,
    setLastChecked,
    uploadKey,
    bumpUploadKey: () => setUploadKey((value) => value + 1),
    readyToRun,
    uploadCount,
    progress,
    missingPreview,
    cam1Preview,
    cam2Preview,
    resetSession,
    handleRunAnalysis,
    handleResetPlatform,
    handleExportEvidence,
    streamUrl,
    snapshotUrl: (filename: string) => `${BACKEND_URL}/api/snapshots/${sessionId}/${encodeURIComponent(filename)}`,
  };

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("useWorkflow must be used within WorkflowProvider");
  }
  return context;
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read snapshot image."));
    reader.readAsDataURL(blob);
  });
}

function buildEvidenceReport({
  sessionId,
  alerts,
  backendUrl,
}: {
  sessionId: string | null;
  alerts: Array<AlertItem & { snapshotDataUrl: string | null }>;
  backendUrl: string;
}) {
  const rows = alerts
    .map(
      (alert) => `
        <article class="card">
          <div class="card-meta">
            <span>${alert.camera}</span>
            <span>${alert.timestamp}</span>
            <span>${formatTime(alert.video_timestamp)}</span>
            <span>${formatPercent(alert.score)}</span>
          </div>
          <div class="card-body">
            <div>
              <h2>Detected snapshot</h2>
              <p>Snapshot file: ${alert.snapshot ?? "--"}</p>
              <p>Euclidean distance: ${alert.euclidean_distance?.toFixed(3) ?? "--"}</p>
            </div>
            ${alert.snapshotDataUrl ? `<img src="${alert.snapshotDataUrl}" alt="${alert.camera} snapshot" />` : `<div class="placeholder">Snapshot unavailable</div>`}
          </div>
        </article>
      `,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Surveillance Evidence Report</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: Inter, Arial, sans-serif; background: #fff; color: #000; }
    .wrap { max-width: 1100px; margin: 0 auto; padding: 32px; }
    .hero { border: 1px solid rgba(0,0,0,.12); border-radius: 28px; padding: 28px; background: linear-gradient(180deg, #fff, #f7f7f7); }
    .hero h1 { margin: 0 0 10px; font-size: 34px; }
    .hero p, .meta { color: rgba(0,0,0,.68); line-height: 1.7; }
    .grid { display: grid; gap: 18px; margin-top: 22px; }
    .card { border: 1px solid rgba(0,0,0,.1); border-radius: 24px; overflow: hidden; background: #fff; box-shadow: 0 18px 40px rgba(0,0,0,.06); }
    .card-meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; padding: 16px 18px; background: rgba(0,0,0,.03); font-size: 12px; text-transform: uppercase; letter-spacing: .14em; }
    .card-body { display: grid; grid-template-columns: 1.1fr .9fr; gap: 18px; padding: 18px; align-items: center; }
    .card-body h2 { margin: 0 0 8px; font-size: 22px; }
    .card-body p { margin: 0 0 8px; color: rgba(0,0,0,.66); }
    .card-body img, .placeholder { width: 100%; min-height: 260px; border-radius: 20px; object-fit: cover; background: linear-gradient(135deg, rgba(0,0,0,.05), rgba(0,0,0,.02)); border: 1px solid rgba(0,0,0,.08); }
    .placeholder { display: grid; place-items: center; color: rgba(0,0,0,.45); }
    @media (max-width: 760px) { .card-meta, .card-body { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <h1>Surveillance Evidence Report</h1>
      <p>Session: ${sessionId ?? "N/A"}</p>
      <p>Backend: ${backendUrl}</p>
      <p>This report includes the detected snapshot for each alert and preserves the time, camera number, confidence score, and source file name.</p>
    </section>
    <div class="grid">
      ${rows || `<article class="card"><div class="card-body"><div><h2>No alerts captured</h2><p>No detection matches were present for this session.</p></div></div></article>`}
    </div>
  </div>
</body>
</html>`;
}

export function useWorkflowState() {
  return useWorkflow();
}
