"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BackArrow } from "../back-arrow";
import { useWorkflow } from "../workflow-provider";

export default function VideosPage() {
  const router = useRouter();
  const { cam1, cam2, setCam1, setCam2, cam1Preview, cam2Preview, setStep, uploadKey } = useWorkflow();
  const [dragTarget, setDragTarget] = useState<"cam1" | "cam2" | null>(null);

  return (
    <main className="relative h-[100dvh] overflow-hidden text-black">
      <div className="pointer-events-none absolute inset-0 hero-grid opacity-60" />
      <div className="pointer-events-none absolute -left-20 top-10 h-60 w-60 rounded-full bg-[#ffd6b8]/60 blur-3xl float-slow" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-60 w-60 rounded-full bg-[#bfd6ff]/60 blur-3xl float-slow-delayed" />

      <div className="relative mx-auto grid h-full w-full max-w-7xl grid-rows-[auto,1fr,auto] gap-4 px-4 py-4 sm:px-8 sm:py-6 lg:px-10">
        <header className="glass-panel reveal flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <BackArrow fallbackHref="/photo" />
            <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-black/50">Step 2</p>
            <h1 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">Camera Upload and Preview Grid</h1>
            </div>
          </div>
          <div className="rounded-full border border-black/15 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-black/70">
            No Scroll Dashboard
          </div>
        </header>

        <section className="min-h-0 reveal-delay-1 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="glass-panel min-h-0 p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-black/45">Upload Controls</p>
                <h2 className="mt-1 text-lg font-bold">CAM-1 and CAM-2 Inputs</h2>
              </div>
              <span className="rounded-full border border-black/15 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-black/60">
                Ready: {cam1 && cam2 ? "Yes" : "No"}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <UploadCard
                keyName={`cam1-${uploadKey}`}
                label="Camera feed 1"
                hint="Video source for CAM-1."
                fileName={cam1?.name}
                dragActive={dragTarget === "cam1"}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragTarget("cam1");
                }}
                onDragLeave={() => setDragTarget((target) => (target === "cam1" ? null : target))}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragTarget(null);
                  const file = event.dataTransfer.files?.[0] ?? null;
                  if (file && file.type.startsWith("video/")) {
                    setCam1(file);
                  }
                }}
                onChange={(event) => setCam1(event.target.files?.[0] ?? null)}
              />
              <UploadCard
                keyName={`cam2-${uploadKey}`}
                label="Camera feed 2"
                hint="Video source for CAM-2."
                fileName={cam2?.name}
                dragActive={dragTarget === "cam2"}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragTarget("cam2");
                }}
                onDragLeave={() => setDragTarget((target) => (target === "cam2" ? null : target))}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragTarget(null);
                  const file = event.dataTransfer.files?.[0] ?? null;
                  if (file && file.type.startsWith("video/")) {
                    setCam2(file);
                  }
                }}
                onChange={(event) => setCam2(event.target.files?.[0] ?? null)}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center justify-center rounded-full border border-black/20 bg-white/90 px-5 py-2.5 text-sm font-semibold text-black transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.12)]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep(3);
                  router.push("/review");
                }}
                disabled={!cam1 || !cam2}
                className="inline-flex items-center justify-center rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-black/90 hover:shadow-[0_8px_20px_rgba(0,0,0,0.24)] disabled:cursor-not-allowed disabled:bg-black/25"
              >
                Continue to Analysis
              </button>
            </div>
          </div>

          <div className="glass-panel min-h-0 p-4 sm:p-5">
            <div className="mb-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-black/45">Render Previews</p>
              <h2 className="mt-1 text-lg font-bold">Smooth Video Preview Panels</h2>
            </div>
            <div className="grid min-h-0 gap-3 lg:grid-cols-2">
              <PreviewCard title="CAM-1 preview">
                {cam1Preview ? (
                  <video src={cam1Preview} controls className="h-full w-full object-cover transition duration-500" />
                ) : (
                  <Placeholder text="CAM-1 preview" />
                )}
              </PreviewCard>
              <PreviewCard title="CAM-2 preview">
                {cam2Preview ? (
                  <video src={cam2Preview} controls className="h-full w-full object-cover transition duration-500" />
                ) : (
                  <Placeholder text="CAM-2 preview" />
                )}
              </PreviewCard>
            </div>
          </div>
        </section>

        <footer className="reveal-delay-2 glass-panel flex flex-col items-start justify-between gap-2 px-4 py-3 text-xs text-black/70 sm:flex-row sm:items-center">
          <p>
            Developed by Ayush Kathil
          </p>
          <div className="flex items-center gap-3">
            <a href="https://www.linkedin.com/in/ayushkathil/" target="_blank" rel="noreferrer" className="rounded-full border border-black/20 bg-white px-3 py-1.5 font-semibold transition hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(0,0,0,0.12)]">
              LinkedIn
            </a>
            <a href="https://github.com/Ayush-kathil" target="_blank" rel="noreferrer" className="rounded-full border border-black/20 bg-white px-3 py-1.5 font-semibold transition hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(0,0,0,0.12)]">
              GitHub
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}

function UploadCard({
  keyName,
  label,
  hint,
  fileName,
  dragActive,
  onDragOver,
  onDragLeave,
  onDrop,
  onChange,
}: {
  keyName: string;
  label: string;
  hint: string;
  fileName?: string;
  dragActive?: boolean;
  onDragOver?: (event: React.DragEvent<HTMLLabelElement>) => void;
  onDragLeave?: () => void;
  onDrop?: (event: React.DragEvent<HTMLLabelElement>) => void;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`block rounded-[1.25rem] border border-dashed bg-white/80 p-3 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,0,0,0.08)] ${dragActive ? "border-black/45 bg-black/[0.06]" : "border-black/20 hover:border-black/35"}`}
    >
      <p className="text-sm font-semibold text-black">{label}</p>
      <p className="mt-1 text-xs leading-5 text-black/55">{hint} Drag and drop is supported.</p>
      <input
        key={keyName}
        type="file"
        accept="video/*"
        onChange={onChange}
        className="mt-3 block w-full text-xs text-black/70 file:mr-3 file:rounded-full file:border-0 file:bg-black file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white"
      />
      <p className="mt-3 truncate text-xs text-black/50">{fileName ?? "No file selected"}</p>
    </label>
  );
}

function PreviewCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-black/15 bg-white/85 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
      <div className="border-b border-black/10 px-3 py-2">
        <p className="text-sm font-semibold text-black">{title}</p>
      </div>
      <div className="relative aspect-video bg-black/[0.03]">{children}</div>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return <div className="flex h-full w-full items-center justify-center text-sm text-black/45">{text}</div>;
}
