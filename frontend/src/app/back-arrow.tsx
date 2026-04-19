"use client";

import { useRouter } from "next/navigation";

export function BackArrow({ fallbackHref = "/" }: { fallbackHref?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
          return;
        }
        router.push(fallbackHref);
      }}
      aria-label="Go back"
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white/90 text-black shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition duration-300 hover:-translate-y-0.5 hover:bg-white"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
