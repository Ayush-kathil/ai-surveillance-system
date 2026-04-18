"use client";

import Link from "next/link";
import { useWorkflow } from "../workflow-provider";

export default function VideosPage() {
  const { cam1, cam2, setCam1, setCam2, cam1Preview, cam2Preview, setStep } = useWorkflow();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ffffff_0%,#f5f5f5_42%,#ebebeb_100%)] text-black">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-8 sm:px-10 lg:px-12">
        <section className="w-full space-y-6 fade-in-up">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-white">
              Step 2
            </div>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
              Upload the camera videos.
            </h1>
            <p className="mx-auto max-w-2xl text-sm leading-7 text-black/65 sm:text-base">
              Add the two surveillance clips and confirm the previews before moving into the live review page.
            </p>
          </div>

          <div className="space-y-5 rounded-[2rem] border border-black/10 bg-white p-5 shadow-[0_18px_48px_rgba(0,0,0,0.06)] sm:p-6">
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.24em] text-black/45">Camera uploads</p>
              <h2 className="mt-2 text-2xl font-bold text-black">CAM-1 and CAM-2 footage</h2>
            </div>

            <UploadCard label="Camera feed 1" hint="Video source for CAM-1." fileName={cam1?.name} onChange={(event) => setCam1(event.target.files?.[0] ?? null)} />
            <UploadCard label="Camera feed 2" hint="Video source for CAM-2." fileName={cam2?.name} onChange={(event) => setCam2(event.target.files?.[0] ?? null)} />

            <div className="grid gap-4 lg:grid-cols-2">
              <PreviewCard title="CAM-1 preview">
                {cam1Preview ? (
                  <video src={cam1Preview} controls className="h-full w-full object-cover" />
                ) : (
                  <Placeholder text="CAM-1 preview" />
                )}
              </PreviewCard>
              <PreviewCard title="CAM-2 preview">
                {cam2Preview ? (
                  <video src={cam2Preview} controls className="h-full w-full object-cover" />
                ) : (
                  <Placeholder text="CAM-2 preview" />
                )}
              </PreviewCard>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center justify-center rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-black/[0.03]"
              >
                Back
              </button>
              <Link
                href="/review"
                onClick={() => setStep(3)}
                className={`inline-flex items-center justify-center rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/90 ${!cam1 || !cam2 ? "pointer-events-none cursor-not-allowed bg-black/20" : ""}`}
              >
                Next
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function UploadCard({
  label,
  hint,
  fileName,
  onChange,
}: {
  label: string;
  hint: string;
  fileName?: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="block rounded-[1.5rem] border border-dashed border-black/15 bg-black/[0.02] p-4 transition hover:border-black/30 hover:bg-black/[0.03]">
      <p className="text-sm font-semibold text-black">{label}</p>
      <p className="mt-1 text-xs leading-5 text-black/55">{hint}</p>
      <input
        type="file"
        accept="video/*"
        onChange={onChange}
        className="mt-4 block w-full text-sm text-black/70 file:mr-3 file:rounded-full file:border-0 file:bg-black file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
      />
      <p className="mt-3 truncate text-xs text-black/50">{fileName ?? "No file selected"}</p>
    </label>
  );
}

function PreviewCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-black/10 bg-black/[0.02]">
      <div className="border-b border-black/10 px-4 py-3">
        <p className="text-sm font-semibold text-black">{title}</p>
      </div>
      <div className="relative aspect-video bg-white">{children}</div>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return <div className="flex h-full w-full items-center justify-center text-sm text-black/45">{text}</div>;
}
