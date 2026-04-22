import Link from "next/link";
import { BrandMark } from "./brand-mark";

export default function Home() {
  return (
    <main className="app-shell relative min-h-screen overflow-hidden text-black">
      <div className="pointer-events-none absolute inset-0 hero-grid opacity-80" />
      <div className="pointer-events-none absolute -left-24 top-24 h-80 w-80 rounded-full bg-[#f2e1d0]/70 blur-3xl float-slow" />
      <div className="pointer-events-none absolute right-[-4rem] top-[-2rem] h-[28rem] w-[28rem] rounded-full bg-[#c8d6e6]/50 blur-3xl float-slow-delayed" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl place-items-center px-6 py-10 sm:px-10 lg:px-12">
        <section className="reveal space-y-8 text-center">
          <div className="mx-auto inline-flex items-center gap-3 rounded-full border border-black/15 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-black shadow-[0_12px_30px_rgba(0,0,0,0.08)] backdrop-blur-sm">
            <BrandMark compact showLabel={false} />
            <span>Smart Surveillance Platform</span>
          </div>

          <h1 className="mx-auto max-w-5xl text-balance text-5xl font-extrabold tracking-[-0.03em] sm:text-6xl lg:text-7xl">
            Human-centered detection intelligence for missing person investigations.
          </h1>

          <p className="mx-auto max-w-3xl text-pretty text-sm leading-7 text-black/70 sm:text-base">
            A refined 3-step workflow designed for operators under pressure. Upload a reference image, attach camera feeds, and review live matches with confident, evidence-ready exports.
          </p>

          <div className="reveal-delay-1 mx-auto flex max-w-3xl flex-wrap justify-center gap-3 text-xs uppercase tracking-[0.24em] text-black/60">
            <span className="rounded-full border border-black/15 bg-white/85 px-4 py-2">Photo Match</span>
            <span className="rounded-full border border-black/15 bg-white/85 px-4 py-2">Dual Stream</span>
            <span className="rounded-full border border-black/15 bg-white/85 px-4 py-2">Live Alerts</span>
            <span className="rounded-full border border-black/15 bg-white/85 px-4 py-2">Evidence Export</span>
          </div>

          <div className="reveal-delay-2 mx-auto flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/photo"
              className="group inline-flex items-center justify-center rounded-full border border-black bg-black px-7 py-3 text-sm font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(0,0,0,0.25)]"
            >
              Start Workflow
              <span className="ml-2 transition duration-300 group-hover:translate-x-0.5">→</span>
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full border border-black/20 bg-white/90 px-7 py-3 text-sm font-semibold text-black transition duration-300 hover:-translate-y-0.5 hover:bg-white"
            >
              Open Command Center
            </Link>
          </div>

          <div className="reveal-delay-3 mx-auto grid w-full max-w-5xl gap-4 pt-5 md:grid-cols-3">
            <article className="glass-panel p-5 text-left">
              <p className="text-[11px] uppercase tracking-[0.24em] text-black/45">01</p>
              <h2 className="mt-2 text-xl font-bold">Reference Upload</h2>
              <p className="mt-2 text-sm leading-6 text-black/65">
                Operators load a clear portrait photo to initialize facial embedding and reduce false positives.
              </p>
            </article>
            <article className="glass-panel p-5 text-left">
              <p className="text-[11px] uppercase tracking-[0.24em] text-black/45">02</p>
              <h2 className="mt-2 text-xl font-bold">Camera Intelligence</h2>
              <p className="mt-2 text-sm leading-6 text-black/65">
                Two synchronized camera inputs are processed in one control view with frame-level transparency.
              </p>
            </article>
            <article className="glass-panel p-5 text-left">
              <p className="text-[11px] uppercase tracking-[0.24em] text-black/45">03</p>
              <h2 className="mt-2 text-xl font-bold">Evidence Actions</h2>
              <p className="mt-2 text-sm leading-6 text-black/65">
                Capture time, score, snapshot, and export in one step for investigators and reporting teams.
              </p>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
