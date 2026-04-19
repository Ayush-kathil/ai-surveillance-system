import Image from "next/image";

type BrandMarkProps = {
  compact?: boolean;
  showLabel?: boolean;
};

export function BrandMark({ compact = false, showLabel = true }: BrandMarkProps) {
  const size = compact ? 34 : 44;

  return (
    <div className="inline-flex items-center gap-3">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-full border border-black/10 bg-white shadow-[0_10px_24px_rgba(0,0,0,0.12)]" style={{ width: size, height: size }}>
        <Image src="/logo.png" alt="Surveillance System logo" width={size} height={size} className="h-full w-full scale-150 object-cover" priority />
      </div>
      {showLabel && (
        <div className="leading-tight">
          <p className="text-[11px] uppercase tracking-[0.26em] text-black/45">Missing Person</p>
          <p className="text-sm font-semibold text-black">Surveillance System</p>
        </div>
      )}
    </div>
  );
}