"use client";

import type { Racer } from "@/lib/types";


interface RacerTrackProps {
  racer: Racer;
  isSelf: boolean;
}

/**
 * A single racer's lane. The marker is a small amber "pace wedge" rather
 * than a literal car sprite — it reuses the pace-light visual language
 * instead of introducing a mismatched illustration style.
 */
export default function RacerTrack({ racer, isSelf }: RacerTrackProps) {
  const clamped = Math.min(100, Math.max(0, racer.progressPercent));
  
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 shrink-0 truncate font-sans text-xs text-[#8A9099]">
        {racer.name}
        {isSelf && <span className="ml-1 text-[#F2C14E]">(you)</span>}
      </div>

      <div className="relative h-2 flex-1 overflow-visible rounded-full border border-[#1E2329] bg-[#101316]">
        {/* filled portion of the track */}
        <div
          className="h-full rounded-full bg-[#f2c14e89] transition-[width] duration-150 ease-out"
          style={{ width: `${clamped}%` }}
        />

        {/* pace marker riding at the leading edge */}
        <div
          className="absolute top-1/2 -translate-y-1/2 transition-all duration-150 ease-out"
          style={{ left: `calc(${clamped}% - 6px)` }}
        >
          <div
            className={[
              "h-3 w-3 rotate-45",
              isSelf ? "bg-[#F2C14E]" : "bg-[#8A9099]",
              racer.finished
                ? "shadow-[0_0_10px_2px_rgba(242,193,78,0.6)]"
                : "",
            ].join(" ")}
          />
        </div>
      </div>

      <div className="w-16 shrink-0 font-mono text-xs text-[#8A9099]">
        <div className={`w-16 ${!racer.finished && 'opacity-0'} text-right font-mono text-xs text-green-400`}>done</div>
        <div className="w-16 text-right font-mono text-sm text-[#8A9099]">{`${Math.round(racer.wpm)} wpm`}</div>
      </div>
    </div>
  );
}