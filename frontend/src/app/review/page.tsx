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
    backendProgress,
    jobState,
    analysisProfile,
    setAnalysisProfile,
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

  const firstAlertTimestamp = alerts.length > 0 ? alerts[0]?.timestamp ?? "--" : null;

  return (
    <main className="relative h-[100dvh] overflow-y-auto text-black">
      <div className="pointer-events-none absolute inset-0 hero-grid opacity-55" />
      <div className="pointer-events-none absolute left-[-6rem] top-[-4rem] h-72 w-72 rounded-full bg-[#ffd8c2]/60 blur-3xl float-slow" />
      <div className="pointer-events-none absolute right-[-6rem] bottom-[-4rem] h-80 w-80 rounded-full bg-[#b6d6ff]/60 blur-3xl float-slow-delayed" />

      <div className="relative mx-auto grid h-full w-full max-w-[1500px] grid-rows-[auto,1fr] gap-4 px-4 py-4 sm:px-8 sm:py-6">
        <header className="glass-panel reveal flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-black/48">Step 3</p>
            <h1 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">Live Analysis and Evidence Console</h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-black/70">
            <span className={`h-2.5 w-2.5 rounded-full ${status === "online" ? "bg-emerald-500" : status === "offline" ? "bg-rose-500" : "bg-zinc-400"}`} />
            {status === "online" ? "Backend online" : status === "offline" ? "Backend offline" : "Checking"}
          </div>
        </header>

        <section className="min-h-0 grid gap-4 lg:grid-cols-[1.45fr_0.95fr]">
          <div className="min-h-0 space-y-4 reveal-delay-1">
            <article className="glass-panel p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-black/45">Detection Progress</p>
                  <h2 className="mt-1 text-lg font-bold">Session Progress and Inputs</h2>
                </div>
                <span className="rounded-full border border-black/15 bg-white px-3 py-1 text-xs font-semibold">{alerts.length} alerts</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <MetricCard label="Progress" value={`${progress}%`} />
                <MetricCard label="Job" value={jobState} />
                <MetricCard label="Session" value={sessionId ? "Active" : "Ready"} />
                <MetricCard label="Backend" value={status} />
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full border border-black/10 bg-white">
                <div className="h-full rounded-full bg-black transition-all duration-700" style={{ width: `${backendProgress}%` }} />
              </div>
              <p className="mt-2 text-xs text-black/55">Real processing progress: {backendProgress}%</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <MiniPreview title="Missing photo" src={missingPreview} fallback="Missing person photo" />
                <MiniPreview title="CAM-1 input" src={cam1Preview} fallback="CAM-1 preview" video />
                <MiniPreview title="CAM-2 input" src={cam2Preview} fallback="CAM-2 preview" video />
              </div>
            </article>

            <article className="glass-panel p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-black/45">Live Streams</p>
                  <h2 className="mt-1 text-lg font-bold">Smooth Camera Rendering</h2>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-black/55">Profile</label>
                  <select
                    value={analysisProfile}
                    onChange={(event) => setAnalysisProfile(event.target.value as "fast" | "balanced" | "accurate")}
                    className="rounded-full border border-black/20 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em]"
                  >
                    <option value="fast">Fast</option>
                    <option value="balanced">Balanced</option>
                    <option value="accurate">Accurate</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleRunAnalysis}
                    disabled={!readyToRun || loading}
                    className="rounded-full bg-black px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition duration-300 hover:-translate-y-0.5 hover:bg-black/90 hover:shadow-[0_10px_20px_rgba(0,0,0,0.2)] disabled:cursor-not-allowed disabled:bg-black/30"
                  >
                    {loading ? "Starting..." : sessionId ? "Running" : "Start Analysis"}
                  </button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <FeedCard title="CAM-1" src={sessionId ? streamUrl("CAM-1") : null} />
                <FeedCard title="CAM-2" src={sessionId ? streamUrl("CAM-2") : null} />
              </div>
            </article>

            <article className="glass-panel min-h-0 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-black/45">Detected Alerts</p>
                  <h2 className="mt-1 text-lg font-bold">Evidence Timeline</h2>
                </div>
                <span className="rounded-full border border-black/15 bg-white px-3 py-1 text-xs font-semibold">{alerts.length} items</span>
              </div>

              <div className="max-h-[24dvh] overflow-auto pr-1 sm:max-h-[28dvh] lg:max-h-[30dvh]">
                {alerts.length === 0 ? (
                  <div className="rounded-[1.2rem] border border-dashed border-black/20 bg-white/70 p-6 text-center text-sm text-black/55">
                    {sessionId ? "No alerts yet. Detection is scanning both streams." : "Start analysis to populate alert evidence."}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alerts.map((alert, index) => (
                      <article key={`${alert.timestamp}-${index}`} className="rounded-[1.2rem] border border-black/12 bg-white/90 p-3 shadow-[0_10px_20px_rgba(0,0,0,0.08)] transition duration-300 hover:-translate-y-0.5">
                        <div className="grid gap-2 sm:grid-cols-4">
                          <MetaItem label="Camera" value={alert.camera} />
                          <MetaItem label="Timestamp" value={alert.timestamp} />
                          <MetaItem label="Video" value={alert.video_timestamp ?? "--:--:--"} />
                          <MetaItem label="Score" value={`${Math.round(alert.score * 1000) / 10}%`} />
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-[1.2fr_0.8fr]">
                          <div className="text-xs text-black/68">
                            <p>Snapshot: {alert.snapshot ?? "--"}</p>
                            <p className="mt-1">Euclidean Distance: {alert.euclidean_distance?.toFixed(3) ?? "--"}</p>
                          </div>
                          <div className="overflow-hidden rounded-xl border border-black/10 bg-black/[0.03]">
                            <div className="relative aspect-video">
                              {alert.snapshot ? (
                                <img src={snapshotUrl(alert.snapshot)} alt={`${alert.camera} snapshot`} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs text-black/45">No snapshot</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </article>
          </div>

          <aside className="min-h-0 reveal-delay-2 space-y-4">
            <article className="glass-panel p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-black/45">Report Panel</p>
              <h2 className="mt-1 text-lg font-bold">Evidence Export</h2>
              <p className="mt-2 text-sm leading-6 text-black/65">
                Export a full PDF report with session summary, similarity score, timestamps, euclidean distance, and snapshots.
              </p>
              <p className="mt-2 text-xs text-black/55">
                First alert timestamp: {firstAlertTimestamp ?? "Waiting for first detection..."}
              </p>
              <button
                type="button"
                onClick={handleExportEvidence}
                disabled={alerts.length === 0}
                className="mt-4 w-full rounded-full bg-black px-4 py-3 text-sm font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-black/90 hover:shadow-[0_10px_20px_rgba(0,0,0,0.24)] disabled:cursor-not-allowed disabled:bg-black/25"
              >
                Export Evidence PDF
              </button>
            </article>

            <article className="glass-panel p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-black/45">Workflow Controls</p>
              <h2 className="mt-1 text-lg font-bold">Actions</h2>
              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={resetSession}
                  className="rounded-full border border-black/15 bg-white px-4 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 hover:bg-white"
                >
                  Reset Session
                </button>
                <button
                  type="button"
                  onClick={handleResetPlatform}
                  disabled={resetting}
                  className="rounded-full border border-black/15 bg-white px-4 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {resetting ? "Resetting Platform..." : "Reset Platform"}
                </button>
                <Link href="/videos" onClick={() => setStep(2)} className="rounded-full border border-black/15 bg-white px-4 py-2.5 text-center text-sm font-semibold transition hover:-translate-y-0.5 hover:bg-white">
                  Back to Videos
                </Link>
                <Link href="/photo" onClick={() => setStep(1)} className="rounded-full border border-black/15 bg-white px-4 py-2.5 text-center text-sm font-semibold transition hover:-translate-y-0.5 hover:bg-white">
                  Back to Photo
                </Link>
              </div>
              {error && <Notice tone="error" message={error} />}
              {backendError && <Notice tone="warning" message={backendError} />}
              {resetInfo && <Notice tone="success" message={resetInfo} />}
            </article>

            <article className="glass-panel p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-black/45">Developer</p>
              <h2 className="mt-1 text-lg font-bold">Ayush Kathil</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href="https://www.linkedin.com/in/ayushkathil/" target="_blank" rel="noreferrer" className="rounded-full border border-black/20 bg-white px-3 py-1.5 text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(0,0,0,0.12)]">
                  LinkedIn
                </a>
                <a href="https://github.com/Ayush-kathil" target="_blank" rel="noreferrer" className="rounded-full border border-black/20 bg-white px-3 py-1.5 text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(0,0,0,0.12)]">
                  GitHub
                </a>
              </div>
            </article>
          </aside>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/12 bg-white/85 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.2em] text-black/45">{label}</p>
      <p className="mt-1 text-sm font-semibold capitalize">{value}</p>
    </div>
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
    <div className="overflow-hidden rounded-[1rem] border border-black/15 bg-white/90 shadow-[0_8px_18px_rgba(0,0,0,0.08)]">
      <div className="border-b border-black/10 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/70">{title}</p>
      </div>
      <div className="relative aspect-video bg-black/[0.02]">
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
    <div className="overflow-hidden rounded-[1.1rem] border border-black/15 bg-white/92 shadow-[0_10px_20px_rgba(0,0,0,0.09)] transition duration-500 hover:-translate-y-0.5">
      <div className="border-b border-black/10 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/70">{title} live stream</p>
      </div>
      <div className="relative aspect-video bg-black/[0.02]">
        {src ? (
          <img src={src} alt={`${title} stream`} className="h-full w-full object-cover transition duration-500" />
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
      <p className="text-[10px] uppercase tracking-[0.2em] text-black/45">{label}</p>
      <p className="mt-1 text-xs font-semibold text-black">{value}</p>
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
