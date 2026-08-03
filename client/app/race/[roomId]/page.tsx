"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import type { Racer, RaceState, RaceStatus } from "@/lib/types";
import RacerTrack from "@/components/race/RacerTrack";
import TypingPassage from "@/components/race/TypingPassage";
import WaitingRoom from "@/components/race/WaitingRoom";
import { Clock, FileText, Gauge, Target } from "lucide-react";

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

  const [bestWpm, setBestWpm] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const [feedback, setFeedback] = useState<string | null>(null);

  const RACE_TIME_LIMIT_SECONDS = 60; // TODO(you): tune this, or pull from room config sent by server


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

    socket.on("race_feedback", ({ feedback }) => {
      setFeedback(feedback);
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
      socket.off("race_feedback");
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

  // tick timeLeft down every second while racing
  useEffect(() => {
    if (status !== "racing" || !startedAt) return;

    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(RACE_TIME_LIMIT_SECONDS - elapsedSeconds, 0);
      setTimeLeft(remaining);

      // TODO(you): when this hits 0, you likely want to emit something to the
      // server so it can force-finish the race — a client-side timer alone
      // can't be trusted to end the race authoritatively (same rule as before:
      // the server decides when the race is actually over).
    }, 1000);

    return () => clearInterval(interval);
  }, [status, startedAt]);

  // track personal best wpm as selfWpm updates
  useEffect(() => {
    if (selfWpm > bestWpm) setBestWpm(selfWpm);
  }, [selfWpm, bestWpm]);

  const totalWords = useMemo(
    () => (passage ? passage.trim().split(/\s+/).length : 0),
    [passage]
  );
  const wordsTyped = useMemo(
    () => (typedText ? typedText.trim().split(/\s+/).length : 0),
    [typedText]
  );

  const accuracy = useMemo(() => {
    if (typedText.length === 0) return 100;
    let correct = 0;
    for (let i = 0; i < typedText.length; i++) {
      if (typedText[i] === passage[i]) correct++;
    }
    return Math.round((correct / typedText.length) * 100);
    // TODO(you): for the number that actually matters (leaderboards, results
    // screen), use the server's calculated accuracy — this is a local,
    // display-only estimate for the live stats bar.
  }, [typedText, passage]);

  function formatTime(seconds: number | null) {
    if (seconds === null) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

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

            <div className="flex items-center justify-between rounded-lg border border-[#1E2329] bg-[#101316] px-6 py-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#8A9099]" />
                <div className="flex flex-col">
                  <span className="font-sans text-[10px] uppercase tracking-[0.15em] text-[#8A9099]">
                    Time Left
                  </span>
                  <span className="font-mono text-sm text-[#F2C14E]">
                    {formatTime(timeLeft)}
                  </span>
                </div>
              </div>

              <div className="h-8 w-px bg-[#1E2329]" />

              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#8A9099]" />
                <div className="flex flex-col">
                  <span className="font-sans text-[10px] uppercase tracking-[0.15em] text-[#8A9099]">
                    Words
                  </span>
                  <span className="font-mono text-sm text-white">
                    {wordsTyped} / {totalWords}
                  </span>
                </div>
              </div>

              <div className="h-8 w-px bg-[#1E2329]" />

              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-[#8A9099]" />
                <div className="flex flex-col">
                  <span className="font-sans text-[10px] uppercase tracking-[0.15em] text-[#8A9099]">
                    Best WPM
                  </span>
                  <span className="font-mono text-sm text-white">{bestWpm}</span>
                </div>
              </div>

              <div className="h-8 w-px bg-[#1E2329]" />

              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-[#8A9099]" />
                <div className="flex flex-col">
                  <span className="font-sans text-[10px] uppercase tracking-[0.15em] text-[#8A9099]">
                    Accuracy
                  </span>
                  <span className="font-mono text-sm text-white">{accuracy}%</span>
                </div>
              </div>
            </div>

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
                      Rank {i + 1}. {r.name}
                    </span>
                    <span className="text-[#8A9099]">{r.wpm} wpm</span>
                  </li>
                ))}
            </ol>
            {feedback ? (
              <div className="mt-4 rounded-md border border-[#1E2329] bg-[#0A0B0D] p-4">
                <p className="mb-1 font-sans text-[10px] uppercase tracking-[0.15em] text-[#F2C14E]">
                  Coach&apos;s Note
                </p>
                <p className="font-sans text-sm text-[#8A9099]">{feedback}</p>
              </div>
            ) : (
              <p className="mt-4 font-sans text-xs text-[#8A9099] animate-pulse">
                Generating feedback...
              </p>
            )}
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