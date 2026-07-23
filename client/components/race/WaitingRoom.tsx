"use client";

import PaceLights from "./PaceLights";
import type { Racer } from "@/lib/types";

interface WaitingRoomProps {
  status: "waiting" | "countdown";
  racers: Racer[];
  maxRacers: number;
  countdownValue: number | null;
  roomId: string;
}

export default function WaitingRoom({
  status,
  racers,
  maxRacers,
  countdownValue,
  roomId,
}: WaitingRoomProps) {
  const litCount =
    status === "countdown" ? 3 - Math.max(countdownValue ?? 0, 0) : 0;

  return (
    <div className="flex flex-col items-center gap-6 rounded-lg border border-[#1E2329] bg-[#101316] p-10">
      <div className="font-sans text-xs uppercase tracking-[0.2em] text-[#8A9099]">
        Room <span className="text-[#F2C14E]">{roomId}</span>
      </div>

      {status === "waiting" ? (
        <>
          <p className="font-sans text-sm text-[#8A9099]">
            Waiting for racers — {racers.length}/{maxRacers} joined
          </p>
          <div className="flex gap-2">
            {Array.from({ length: maxRacers }).map((_, i) => (
              <div
                key={i}
                className={[
                  "h-2 w-8 rounded-full",
                  i < racers.length ? "bg-[#F2C14E]" : "bg-[#1E2329]",
                ].join(" ")}
              />
            ))}
          </div>
          {/*
            TODO(you):
            - "Ready up" button that emits `player_ready`.
            - Server decides when to start the countdown: either once every
              connected racer is ready, or a host forces start, or a max-wait
              timeout elapses. That decision must live server-side so a
              client can't fake "everyone's ready".
          */}
        </>
      ) : (
        <>
          <p className="font-sans text-sm text-[#8A9099]">Get ready...</p>
          <PaceLights litCount={litCount} />
          <div className="font-mono text-4xl text-[#F2C14E]">
            {countdownValue && countdownValue > 0 ? countdownValue : "GO"}
          </div>
        </>
      )}
    </div>
  );
}