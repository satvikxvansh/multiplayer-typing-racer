"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import type { Racer, RaceState, RaceStatus } from "@/lib/types";
import RacerTrack from "@/components/race/RacerTrack";
import TypingPassage from "@/components/race/TypingPassage";
import WaitingRoom from "@/components/race/WaitingRoom";

const MAX_RACERS = 2;

export default function RacePage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;

  const [status, setStatus] = useState<RaceStatus>("waiting");
  const [passage, setPassage] = useState("");
  const [racers, setRacers] = useState<Racer[]>([]);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [typedText, setTypedText] = useState("");
  const [selfId, setSelfId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const self = useMemo(
    () => racers.find((r) => r.socketId === selfId) ?? null,
    [racers, selfId]
  );

  // ---- Socket wiring ----
  useEffect(() => {
    const socket = getSocket();
    socket.connect();
    setSelfId(socket.id ?? null);

    socket.emit("join_room", roomId);
    
    socket.emit("player_ready", roomId);

    // socket.on() receives data by listening to the server.
    socket.on("room_state", (state: RaceState) => {
      setStatus(state.status);
      setPassage(state.passage);
      setRacers(state.racers);
      setCountdownValue(state.countdownValue);
    });

    socket.on("countdown_tick", (value) => {
      setStatus("countdown");
      setCountdownValue(value);
    });

    socket.on("race_start", ({ passage: p, startTimestamp }) => {
      setStatus("racing");
      setPassage(p);
      setStartedAt(startTimestamp);
      setTypedText("");
    });

    socket.on("opponent_progress", ({ socketId, progressPercent, wpm }) => {
      setRacers((prev) =>
        prev.map((r) =>
          r.socketId === socketId ? { ...r, progressPercent, wpm } : r
        )
      );
    });

    socket.on("player_finished", ({ socketId, finishTimeMs }) => {
      setRacers((prev) =>
        prev.map((r) =>
          r.socketId === socketId ? { ...r, finished: true, finishTimeMs } : r
        )
      );
    });

    socket.on("race_finished", ({ results }) => {
      setStatus("finished");
      setRacers(results);
    });

    socket.on("error_message", (message) => {
      // TODO(you): surface this in a toast/banner instead of console.
      console.error("Race error:", message);
      alert("Race error, check console");
    });

    // returns cleanup functions, to avoid memory leaks, etc.
    return () => {
      socket.emit("leave_room", roomId);
      socket.off("room_state");
      socket.off("countdown_tick");
      socket.off("race_start");
      socket.off("opponent_progress");
      socket.off("player_finished");
      socket.off("race_finished");
      socket.off("error_message");
      socket.disconnect();
    };
  }, [roomId]);

  // ---- Local typing handler ----
  function handleTypingChange(value: string) {
    setTypedText(value);

    const socket = getSocket();
    socket.emit("typing_progress", {
      roomId,
      typedText: value,
      timestamp: Date.now(),
    });

    // TODO(you): it's fine to show an optimistic local progress % for your
    // OWN bar for instant feedback, but the number every OTHER racer sees
    // must come from the server's `opponent_progress` broadcast — never
    // trust a client-reported percentage for anyone but a rough self-preview.
  }

  const selfWpm = useMemo(() => {
    if (!startedAt || typedText.length === 0) return 0;
    const elapsedMinutes = (Date.now() - startedAt) / 60000;
    if (elapsedMinutes <= 0) return 0;
    const words = typedText.trim().split(/\s+/).length;
    return Math.round(words / elapsedMinutes);
    // TODO(you): this is a local, display-only estimate for responsiveness.
    // The authoritative WPM (the one other racers see, and the one saved to
    // leaderboards) must be computed server-side from validated keystrokes.
  }, [typedText, startedAt]);

  return (
    <main className="min-h-screen bg-[#0A0B0D] px-6 py-10 text-white">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex items-center justify-between font-sans">
          <h1 className="text-sm uppercase tracking-[0.2em] text-[#8A9099]">
            Race — <span className="text-[#F2C14E]">{roomId}</span>
          </h1>
          <span className="font-mono text-xs text-[#8A9099]">{status}</span>
        </header>

        {(status === "waiting" || status === "countdown") && (
          <WaitingRoom
            status={status}
            racers={racers}
            maxRacers={MAX_RACERS}
            countdownValue={countdownValue}
            roomId={roomId}
          />
        )}

        {(status === "racing" || status === "finished") && (
          <>
            <section className="flex flex-col gap-3" aria-label="Racers">
              {racers.map((racer) => (
                <RacerTrack
                  key={racer.socketId}
                  racer={racer}
                  isSelf={racer.socketId === selfId}
                />
              ))}
            </section>

            <section className="flex items-center justify-between font-mono text-sm">
              <span className="text-[#8A9099]">your speed</span>
              <span className="text-[#F2C14E]">{selfWpm} wpm</span>
            </section>

            <TypingPassage
              passage={passage}
              typedText={typedText}
              disabled={status === "finished" || (self?.finished ?? false)}
              onChange={handleTypingChange}
            />
          </>
        )}

        {status === "finished" && (
          <section className="rounded-lg border border-[#1E2329] bg-[#101316] p-6">
            <h2 className="mb-4 font-sans text-xs uppercase tracking-[0.2em] text-[#8A9099]">
              Results
            </h2>
            <ol className="flex flex-col gap-2 font-mono text-sm">
              {[...racers]
                .sort(
                  (a, b) =>
                    (a.finishTimeMs ?? Infinity) - (b.finishTimeMs ?? Infinity)
                )
                .map((r, i) => (
                  <li key={r.socketId} className="flex justify-between">
                    <span
                      className={
                        r.socketId === selfId ? "text-[#F2C14E]" : "text-white"
                      }
                    >
                      {i + 1}. {r.name}
                    </span>
                    <span className="text-[#8A9099]">{r.wpm} wpm</span>
                  </li>
                ))}
            </ol>
            {/*
              TODO(you):
              - "Play again" button that re-joins/re-creates a room.
              - POST match results to your API (e.g. /api/matches) here so
                the server's authoritative results get persisted.
              - Update leaderboard / ELO based on the persisted result.
            */}
          </section>
        )}
      </div>
    </main>
  );
}