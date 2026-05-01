"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { BackArrow } from "../back-arrow";
import { BrandMark } from "../brand-mark";
import { useWorkflow } from "../workflow-provider";

type BoxPayload = {
  camera: "CAM-1" | "CAM-2";
  frame_index: number;
  bbox: [number, number, number, number] | null;
  track_id?: number | null;
  score?: number | null;
};

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8001").replace(/\/+$/, "");

export default function DashboardPage() {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const {
    sessionId,
    alerts,
    loading,
    readyToRun,
    backendProgress,
    jobState,
    wsConnected,
    wsReconnecting,
    latestBoxes,
    missingPreview,
    streamUrl,
    analysisProfile,
    setAnalysisProfile,
    handleRunAnalysis,
    uploadProgress,
    error,
    backendError,
    setStep,
  } = useWorkflow();

  useEffect(() => {
    setStep(3);
  }, [setStep]);

  const handleExport = async () => {
    if (!sessionId) {
      return;
    }
    setExporting(true);
    setExportError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/export/${sessionId}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(String(payload.detail || "Failed to export evidence."));
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `evidence_${sessionId}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to export evidence.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_18%_12%,#f6e8d7_0%,transparent_42%),radial-gradient(circle_at_87%_8%,#dce8f6_0%,transparent_42%),linear-gradient(180deg,#fdfbf7_0%,#f0ebe2_100%)] text-black">
      <div className="pointer-events-none absolute inset-0 hero-grid opacity-55" />
      <div className="relative mx-auto grid min-h-screen w-full max-w-[1700px] grid-rows-[auto,1fr] gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="glass-panel flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <BackArrow fallbackHref="/videos" />
            <div>
              <BrandMark compact />
              <h1 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">Command Center</h1>
              <p className="text-[11px] uppercase tracking-[0.22em] text-black/55">Live Tracking + Alert Intelligence</p>
            </div>
          </div>
          <div className="rounded-full border border-black/15 bg-white/85 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-black/70">
            WS: {wsConnected ? "Connected" : "Disconnected"}
          </div>
        </header>

        {wsReconnecting && (
          <div className="mx-auto w-full max-w-[1700px] rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-900">
            Reconnecting to backend stream...
          </div>
        )}

        <section className="grid min-h-0 gap-4 lg:grid-cols-[300px_1fr_340px]">
          <aside className="glass-panel min-h-0 space-y-4 p-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-black/48">Reference</p>
              <h2 className="mt-1 text-lg font-bold">Missing Person</h2>
            </div>
            <div className="overflow-hidden rounded-2xl border border-black/10 bg-white/85">
              <div className="relative aspect-[4/5]">
                {missingPreview ? (
                  <img src={missingPreview} alt="Reference" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-black/45">Upload a reference photo in Step 1</div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.2em] text-black/55">Profile</label>
              <select
                value={analysisProfile}
                onChange={(event) => setAnalysisProfile(event.target.value as "fast" | "balanced" | "accurate")}
                className="w-full rounded-full border border-black/20 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em]"
              >
                <option value="fast">Fast</option>
                <option value="balanced">Balanced</option>
                <option value="accurate">Accurate</option>
              </select>
              <button
                type="button"
                onClick={handleRunAnalysis}
                disabled={!readyToRun || loading}
                className="w-full rounded-full bg-black px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:bg-black/30"
              >
                {loading ? `Uploading ${uploadProgress.total}%` : sessionId ? "Restart Analysis" : "Start Analysis"}
              </button>
            </div>

            <div className="space-y-2 rounded-2xl border border-black/10 bg-white/80 p-3">
              <Metric label="Job State" value={jobState} />
              <Metric label="Model Progress" value={`${backendProgress}%`} />
              <Metric label="Upload" value={`${uploadProgress.total}%`} />
              <div className="h-2 overflow-hidden rounded-full border border-black/10 bg-white">
                <div className="h-full bg-black transition-all" style={{ width: `${backendProgress}%` }} />
              </div>
            </div>

            <button
              type="button"
              onClick={handleExport}
              disabled={jobState !== "completed" || exporting || !sessionId}
              className="w-full rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? "Generating export..." : "Download Evidence ZIP"}
            </button>
            {exportError && <Notice tone="error" message={exportError} />}

            <Link href="/videos" className="inline-flex w-full items-center justify-center rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold">
              Back To Video Uploads
            </Link>

            {error && <Notice tone="error" message={error} />}
            {backendError && <Notice tone="warning" message={backendError} />}
          </aside>

          <div className="glass-panel min-h-0 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-black/45">2x2 Grid</p>
                <h2 className="mt-1 text-lg font-bold">Live Streams and Overlay Canvas</h2>
              </div>
              <span className="rounded-full border border-black/15 bg-white px-3 py-1 text-xs font-semibold">Alerts: {alerts.length}</span>
            </div>

            <div className="grid h-[calc(100%-3rem)] gap-3 md:grid-cols-2 md:grid-rows-2">
              <VideoCanvasPanel
                title="CAM-1"
                src={sessionId ? streamUrl("CAM-1") : null}
                box={(latestBoxes["CAM-1"] as BoxPayload | null) ?? null}
              />
              <VideoCanvasPanel
                title="CAM-2"
                src={sessionId ? streamUrl("CAM-2") : null}
                box={(latestBoxes["CAM-2"] as BoxPayload | null) ?? null}
              />
              <InfoPanel title="Reference Source">
                {missingPreview ? (
                  <img src={missingPreview} alt="Reference person" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-black/45">Reference image preview</div>
                )}
              </InfoPanel>
              <InfoPanel title="System Telemetry">
                <div className="space-y-2 p-3 text-xs text-black/70">
                  <p>WebSocket: {wsConnected ? "connected" : "disconnected"}</p>
                  <p>Job: {jobState}</p>
                  <p>Detection progress: {backendProgress}%</p>
                  <p>Session: {sessionId ?? "Not started"}</p>
                </div>
              </InfoPanel>
            </div>
          </div>

          <aside className="glass-panel min-h-0 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-black/45">Alert Stream</p>
            <h2 className="mt-1 text-lg font-bold">Live Events</h2>
            <div className="mt-3 h-[calc(100%-3rem)] space-y-2 overflow-auto pr-1">
              {alerts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-black/20 bg-white/75 p-4 text-sm text-black/55">
                  Alerts will stream here over WebSocket as the model processes tracks.
                </div>
              ) : (
                alerts
                  .slice()
                  .reverse()
                  .map((alert, index) => (
                    <article key={`${alert.timestamp}-${index}`} className="rounded-xl border border-black/12 bg-white/90 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-black/70">{alert.camera}</p>
                      <p className="mt-1 text-sm font-bold text-black">Score: {(alert.score * 100).toFixed(1)}%</p>
                      <p className="text-xs text-black/65">Track: {alert.track_id ?? "-"}</p>
                      <p className="text-xs text-black/65">{alert.timestamp}</p>
                      {alert.bounding_box && (
                        <p className="mt-1 text-[11px] text-black/55">BBox: {alert.bounding_box.join(", ")}</p>
                      )}
                    </article>
                  ))
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function VideoCanvasPanel({
  title,
  src,
  box,
}: {
  title: string;
  src: string | null;
  box: BoxPayload | null;
}) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = image?.clientWidth ?? canvas.clientWidth;
    const height = image?.clientHeight ?? canvas.clientHeight;
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!box?.bbox || !image?.naturalWidth || !image.naturalHeight) {
      return;
    }

    const [x1, y1, x2, y2] = box.bbox;
    const scaleX = canvas.width / image.naturalWidth;
    const scaleY = canvas.height / image.naturalHeight;

    const drawX = x1 * scaleX;
    const drawY = y1 * scaleY;
    const drawWidth = Math.max(2, (x2 - x1) * scaleX);
    const drawHeight = Math.max(2, (y2 - y1) * scaleY);

    ctx.strokeStyle = "#35d06b";
    ctx.lineWidth = 2;
    ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);

    const tag = `id:${box.track_id ?? "-"} sim:${typeof box.score === "number" ? box.score.toFixed(2) : "--"}`;
    ctx.font = "12px var(--font-ui-mono), monospace";
    const textWidth = Math.ceil(ctx.measureText(tag).width) + 12;
    const textY = Math.max(16, drawY - 8);

    ctx.fillStyle = "rgba(53, 208, 107, 0.95)";
    ctx.fillRect(drawX, textY - 14, textWidth, 16);
    ctx.fillStyle = "#08140c";
    ctx.fillText(tag, drawX + 6, textY - 2);
  }, [box]);

  return (
    <div className="overflow-hidden rounded-2xl border border-black/12 bg-white/90 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
      <div className="border-b border-black/10 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/70">{title} stream</p>
      </div>
      <div className="relative h-full min-h-[200px] bg-black/[0.03]">
        {src ? (
          <>
            <img ref={imageRef} src={src} alt={`${title} video`} className="h-full w-full object-fill" />
            <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-black/45">Start analysis to open this camera feed.</div>
        )}
      </div>
    </div>
  );
}

function InfoPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-black/12 bg-white/90 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
      <div className="border-b border-black/10 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/70">{title}</p>
      </div>
      <div className="relative h-[calc(100%-2.1rem)] bg-black/[0.02]">{children}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="uppercase tracking-[0.14em] text-black/50">{label}</span>
      <span className="font-semibold text-black/85">{value}</span>
    </div>
  );
}

function Notice({ tone, message }: { tone: "error" | "warning"; message: string }) {
  const toneClasses =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : "border-amber-200 bg-amber-50 text-amber-900";
  return <div className={`rounded-2xl border px-3 py-3 text-xs leading-5 ${toneClasses}`}>{message}</div>;
}
