"use client";

import Link from "next/link";
import { useWorkflow } from "../workflow-provider";

export default function PhotoPage() {
  const { missingImage, setMissingImage, missingPreview, setStep } = useWorkflow();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ffffff_0%,#f5f5f5_42%,#ebebeb_100%)] text-black">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-8 sm:px-10 lg:px-12">
        <section className="w-full space-y-6 fade-in-up">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-white">
              Step 1
            </div>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
              Upload the missing person photo.
            </h1>
            <p className="mx-auto max-w-2xl text-sm leading-7 text-black/65 sm:text-base">
              Add a clear frontal image and preview it here before moving to the camera upload step.
            </p>
          </div>

          <div className="space-y-5 rounded-[2rem] border border-black/10 bg-white p-5 shadow-[0_18px_48px_rgba(0,0,0,0.06)] sm:p-6">
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.24em] text-black/45">Photo upload</p>
              <h2 className="mt-2 text-2xl font-bold text-black">Missing person image</h2>
            </div>

            <label className="block rounded-[1.5rem] border border-dashed border-black/15 bg-black/[0.02] p-4 transition hover:border-black/30 hover:bg-black/[0.03]">
              <p className="text-sm font-semibold text-black">Choose reference image</p>
              <p className="mt-1 text-xs leading-5 text-black/55">The backend uses this photo to generate the facial embedding.</p>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setMissingImage(event.target.files?.[0] ?? null)}
                className="mt-4 block w-full text-sm text-black/70 file:mr-3 file:rounded-full file:border-0 file:bg-black file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
              <p className="mt-3 truncate text-xs text-black/50">{missingImage?.name ?? "No file selected"}</p>
            </label>

            <div className="overflow-hidden rounded-[1.5rem] border border-black/10 bg-black/[0.02]">
              <div className="border-b border-black/10 px-4 py-3">
                <p className="text-sm font-semibold text-black">Preview window</p>
                <p className="mt-1 text-xs text-black/50">A live preview of the selected photo.</p>
              </div>
              <div className="relative aspect-[4/3] bg-white">
                {missingPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={missingPreview} alt="Missing person preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(0,0,0,0.04),rgba(255,255,255,0.8))] text-sm text-black/45">
                    Photo preview will appear here.
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-black/[0.03]"
              >
                Back
              </Link>
              <Link
                href="/videos"
                onClick={() => setStep(2)}
                className={`inline-flex items-center justify-center rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/90 ${!missingImage ? "pointer-events-none cursor-not-allowed bg-black/20" : ""}`}
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
