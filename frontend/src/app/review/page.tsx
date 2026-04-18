"use client";

import Link from "next/link";
import { useWorkflow } from "../workflow-provider";

export default function ReviewPage() {
  const {
    alerts,
    sessionId,
    loading,
    readyToRun,
    progress,
    missingPreview,
    cam1Preview,
    cam2Preview,
    streamUrl,
    status,
    backendError,
    error,
    resetInfo,
    resetSession,
    handleRunAnalysis,
    handleResetPlatform,
    handleExportEvidence,
    resetting,
    setStep,
    snapshotUrl,
  } = useWorkflow();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ffffff_0%,#f5f5f5_42%,#ebebeb_100%)] text-black">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-6 py-8 sm:px-10 lg:px-12">
        <section className="w-full space-y-6 fade-in-up">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-white">
                Step 3
              </div>
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
                Review detection, streams, and exported evidence.
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-black/65 sm:text-base">
                This page stays focused on the live operation: backend status, progress, camera feeds, match alerts, and the exported report containing the detected snapshots.
              </p>
            </div>
            <div className="inline-flex items-center gap-3 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black shadow-[0_12px_30px_rgba(0,0,0,0.05)]">
              <span className={`h-3 w-3 rounded-full ${status === "online" ? "bg-emerald-500" : status === "offline" ? "bg-rose-500" : "bg-zinc-400"}`} />
              {status === "online" ? "Backend online" : status === "offline" ? "Backend offline" : "Checking backend"}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-6">
              <Panel title="Detection progress" subtitle="A simple monotone indicator that rises as the workflow advances.">
                <div className="space-y-4 rounded-[1.5rem] border border-black/10 bg-black/[0.02] p-5">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-black/45">Progress</p>
                      <p className="mt-2 text-4xl font-black">{progress}%</p>
                    </div>
                    <div className="text-right text-xs uppercase tracking-[0.24em] text-black/45">
                      <p>{sessionId ? "Session active" : "Ready"}</p>
                      <p>{alerts.length} alerts</p>
                    </div>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full border border-black/10 bg-white">
                    <div className="h-full rounded-full bg-black transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </Panel>

              <Panel title="Source previews" subtitle="The selected photo and both camera files stay visible here.">
                <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
                  <MiniPreview title="Missing photo" src={missingPreview} fallback="Missing person photo" />
                  <MiniPreview title="CAM-1 preview" src={cam1Preview} fallback="CAM-1 video preview" video />
                  <MiniPreview title="CAM-2 preview" src={cam2Preview} fallback="CAM-2 video preview" video />
                </div>
              </Panel>

              <Panel title="Actions" subtitle="Start, reset, export, or step back to adjust inputs.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleRunAnalysis}
                    disabled={!readyToRun || loading}
                    className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:bg-black/20"
                  >
                    {loading ? "Launching analysis..." : sessionId ? "Analysis running" : "Start analysis"}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportEvidence}
                    disabled={alerts.length === 0}
                    className="rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:text-black/30"
                  >
                    Export evidence report
                  </button>
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
                <div className="mt-4 flex gap-3">
                  <Link href="/videos" onClick={() => setStep(2)} className="rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-black/[0.03]">
                    Back to videos
                  </Link>
                  <Link href="/photo" onClick={() => setStep(1)} className="rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-black/[0.03]">
                    Back to photo
                  </Link>
                </div>
                {error && <Notice tone="error" message={error} />}
                {backendError && <Notice tone="warning" message={backendError} />}
                {resetInfo && <Notice tone="success" message={resetInfo} />}
              </Panel>
            </div>

            <div className="space-y-6">
              <Panel title="Live camera feeds" subtitle="The backend renders the active stream for each camera.">
                <div className="grid gap-4 lg:grid-cols-2">
                  <FeedCard title="CAM-1" src={sessionId ? streamUrl("CAM-1") : null} />
                  <FeedCard title="CAM-2" src={sessionId ? streamUrl("CAM-2") : null} />
                </div>
              </Panel>

              <Panel title="Detected alerts" subtitle="Each alert includes the camera number, time, score, and snapshot file.">
                {alerts.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-black/15 bg-black/[0.02] p-8 text-center text-sm text-black/50">
                    {sessionId ? "No alerts yet. The backend is still scanning the videos." : "Start the analysis to see alerts here."}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {alerts.map((alert, index) => (
                      <article key={`${alert.timestamp}-${index}`} className="overflow-hidden rounded-[1.5rem] border border-black/10 bg-white shadow-[0_16px_30px_rgba(0,0,0,0.05)]">
                        <div className="grid gap-4 border-b border-black/10 bg-black/[0.03] px-5 py-4 sm:grid-cols-4">
                          <MetaItem label="Camera" value={alert.camera} />
                          <MetaItem label="Timestamp" value={alert.timestamp} />
                          <MetaItem label="Video time" value={alert.video_timestamp ?? "--:--:--"} />
                          <MetaItem label="Score" value={`${Math.round(alert.score * 1000) / 10}%`} />
                        </div>
                        <div className="grid gap-4 p-5 lg:grid-cols-[0.9fr_1.1fr]">
                          <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-black/45">Snapshot file</p>
                            <p className="mt-2 text-sm font-semibold text-black">{alert.snapshot ?? "--"}</p>
                            <p className="mt-4 text-sm leading-7 text-black/65">
                              Euclidean distance: {alert.euclidean_distance?.toFixed(3) ?? "--"}
                            </p>
                          </div>
                          <div className="overflow-hidden rounded-[1.25rem] border border-black/10 bg-black/[0.02]">
                            <div className="border-b border-black/10 px-4 py-3">
                              <p className="text-sm font-semibold text-black">Detected person snapshot</p>
                            </div>
                            <div className="relative aspect-video bg-white">
                              {alert.snapshot ? (
                                <img
                                  src={snapshotUrl(alert.snapshot)}
                                  alt={`${alert.camera} snapshot`}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-sm text-black/45">
                                  Snapshot unavailable
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-black/10 bg-white p-5 shadow-[0_18px_48px_rgba(0,0,0,0.06)] sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-black">{title}</h2>
        <p className="mt-1 text-sm text-black/55">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function MiniPreview({
  title,
  src,
  fallback,
  video,
}: {
  title: string;
  src: string | null;
  fallback: string;
  video?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-black/10 bg-black/[0.02]">
      <div className="border-b border-black/10 px-4 py-3">
        <p className="text-sm font-semibold text-black">{title}</p>
      </div>
      <div className="relative aspect-video bg-white">
        {src ? (
          video ? <video src={src} controls className="h-full w-full object-cover" /> : <img src={src} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-black/45">{fallback}</div>
        )}
      </div>
    </div>
  );
}

function FeedCard({ title, src }: { title: string; src: string | null }) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-black/10 bg-black/[0.02]">
      <div className="border-b border-black/10 px-4 py-3">
        <p className="text-sm font-semibold text-black">{title} live stream</p>
      </div>
      <div className="relative aspect-video bg-white">
        {src ? (
          <img src={src} alt={`${title} stream`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-black/45">Start analysis to view live feed</div>
        )}
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.24em] text-black/45">{label}</p>
      <p className="mt-2 text-sm font-semibold text-black">{value}</p>
    </div>
  );
}

function Notice({ tone, message }: { tone: "error" | "warning" | "success"; message: string }) {
  const toneClasses = {
    error: "border-rose-200 bg-rose-50 text-rose-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  }[tone];

  return <div className={`mt-4 rounded-[1.5rem] border px-4 py-4 text-sm leading-6 ${toneClasses}`}>{message}</div>;
}
