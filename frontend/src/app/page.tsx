import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#ffffff_0%,#f5f5f5_42%,#e8e8e8_100%)] text-black">
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10 sm:px-10 lg:px-12">
        <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-black/5 blur-3xl animate-drift" />
        <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-white blur-3xl animate-drift-delayed" />

        <section className="relative z-10 max-w-3xl fade-in-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-white">
            Surveillance System
          </div>
          <h1 className="mt-6 text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
            Missing person detection, built as a clean guided console.
          </h1>
          <p className="mt-6 max-w-2xl text-sm leading-7 text-black/65 sm:text-base">
            Start with a single welcome page, then move through the photo upload page, the camera upload page, and the live review page. The backend stays visible the whole time with a simple status dot.
          </p>

          <div className="mt-10 flex flex-wrap gap-3 text-xs uppercase tracking-[0.24em] text-black/55">
            <span className="rounded-full border border-black/10 bg-white px-4 py-2">Welcome</span>
            <span className="rounded-full border border-black/10 bg-white px-4 py-2">Upload</span>
            <span className="rounded-full border border-black/10 bg-white px-4 py-2">Review</span>
            <span className="rounded-full border border-black/10 bg-white px-4 py-2">Export</span>
          </div>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/photo"
              className="inline-flex items-center justify-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition duration-300 hover:scale-[1.02] hover:bg-black/90"
            >
              Start workflow
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
