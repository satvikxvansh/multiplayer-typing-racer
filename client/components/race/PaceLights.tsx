"use client";

interface PaceLightsProps {
  /** How many lights are lit, 0-3. All three lit = "go". */
  litCount: number;
}

/**
 * Signature element: three amber pace-light dots that fill in one by one
 * during the pre-race countdown, echoing a start-line light sequence.
 */
export default function PaceLights({ litCount }: PaceLightsProps) {
  return (
    <div
      className="flex items-center gap-3"
      role="status"
      aria-label={`${litCount} of 3 pace lights lit`}
    >
      {[0, 1, 2].map((i) => {
        const lit = i < litCount;
        return (
          <span
            key={i}
            className={[
              "h-3 w-3 rounded-full border transition-all duration-300",
              lit
                ? "bg-[#F2C14E] border-[#F2C14E] shadow-[0_0_12px_2px_rgba(242,193,78,0.55)]"
                : "bg-transparent border-[#1E2329]",
            ].join(" ")}
          />
        );
      })}
    </div>
  );
}