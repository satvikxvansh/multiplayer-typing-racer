"use client";

/**
 * Design notes:
 *   Accent  #F2C14E  (amber "pace light" — the start-line glow)
 *   BG      #0A0B0D  Surface #101316  Border #1E2329
 *   Type    monospace carries the race; sans handles the chrome.
 *   Signature: the caret is a solid amber block that rides the text,
 *   and three pace-light dots echo a racing start sequence.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/* -------------------------------------------------------------------------- */
/*  Data                                                                       */
/* -------------------------------------------------------------------------- */

const SAMPLE_TEXTS: readonly string[] = [
  "the quick brown fox jumps over the lazy dog while the whole town sleeps",
  "speed is nothing without control so keep your fingers light and your eyes ahead",
  "every keystroke is a small decision and the fastest typists rarely look down",
  "a steady rhythm beats a frantic sprint when the finish line is still far away",
  "practice the words you fear the most and the rest of the race takes care of itself",
];

type TestStatus = "idle" | "running" | "finished";
type AuthTab = "signin" | "signup";
type AuthMode = AuthTab | null;

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                              */
/* -------------------------------------------------------------------------- */

function pickText(exclude?: string): string {
  const pool = exclude
    ? SAMPLE_TEXTS.filter((t) => t !== exclude)
    : SAMPLE_TEXTS;
  return pool[Math.floor(Math.random() * pool.length)] ?? SAMPLE_TEXTS[0];
}

function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/*  Typing test hook                                                           */
/* -------------------------------------------------------------------------- */

interface TypingState {
  target: string;
  typed: string;
  status: TestStatus;
  elapsedMs: number;
  wpm: number;
  accuracy: number;
  errors: number;
  progress: number;
}

function useTypingTest() {
  const [target, setTarget] = useState<string>(() => pickText());
  const [typed, setTyped] = useState<string>("");
  const [status, setStatus] = useState<TestStatus>("idle");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  // Tick a timer only while running.
  useEffect(() => {
    if (status !== "running") return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [status]);

  // `now` ticks every 100ms while running and is snapped once on finish,
  // so elapsed time freezes correctly at the end of a run.
  const elapsedMs = useMemo(
    () => (startedAt == null ? 0 : Math.max(0, now - startedAt)),
    [startedAt, now]
  );

  const errors = useMemo(() => {
    let count = 0;
    for (let i = 0; i < typed.length; i += 1) {
      if (typed[i] !== target[i]) count += 1;
    }
    return count;
  }, [typed, target]);

  const accuracy = useMemo(() => {
    if (typed.length === 0) return 100;
    const correct = typed.length - errors;
    return Math.max(0, Math.round((correct / typed.length) * 100));
  }, [typed.length, errors]);

  const wpm = useMemo(() => {
    const minutes = elapsedMs / 60000;
    if (minutes <= 0) return 0;
    const correct = Math.max(0, typed.length - errors);
    return Math.round(correct / 5 / minutes);
  }, [elapsedMs, typed.length, errors]);

  const progress = useMemo(
    () => (target.length === 0 ? 0 : Math.min(1, typed.length / target.length)),
    [typed.length, target.length]
  );

  const handleType = useCallback(
    (value: string) => {
      if (status === "finished") return; // race is over

      // Clamp to target length; block over-typing past the finish line.
      const next = value.slice(0, target.length);

      // First keystroke starts the clock.
      if (status === "idle" && next.length > 0) {
        const t = Date.now();
        setStartedAt(t);
        setNow(t);
        setStatus("running");
      }

      setTyped(next);

      // Last correct-length keystroke finishes the run.
      if (next.length === target.length && target.length > 0) {
        setNow(Date.now());
        setStatus("finished");
      }
    },
    [status, target.length]
  );

  const reset = useCallback((useNewText: boolean) => {
    setTarget((current) => (useNewText ? pickText(current) : current));
    setTyped("");
    setStartedAt(null);
    setStatus("idle");
    setNow(Date.now());
  }, []);

  const state: TypingState = {
    target,
    typed,
    status,
    elapsedMs,
    wpm,
    accuracy,
    errors,
    progress,
  };

  return { state, handleType, reset };
}

/* -------------------------------------------------------------------------- */
/*  UI atoms                                                                   */
/* -------------------------------------------------------------------------- */

function PaceLights({ className }: { className?: string }): ReactNode {
  return (
    <span className={classNames("inline-flex items-center gap-1", className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-[#F2C14E] shadow-[0_0_8px_#F2C14E]" />
      <span className="h-1.5 w-1.5 rounded-full bg-[#F2C14E]/70" />
      <span className="h-1.5 w-1.5 rounded-full bg-[#F2C14E]/35" />
    </span>
  );
}

function Stat({
  label,
  value,
  unit,
  emphasis,
}: {
  label: string;
  value: string | number;
  unit?: string;
  emphasis?: boolean;
}): ReactNode {
  return (
    <div className="flex flex-col">
      <span
        className={classNames(
          "font-mono tabular-nums leading-none",
          emphasis ? "text-3xl text-[#F2C14E]" : "text-3xl text-[#E7EAED]"
        )}
      >
        {value}
        {unit ? (
          <span className="ml-1 text-sm text-[#79828B]">{unit}</span>
        ) : null}
      </span>
      <span className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#79828B]">
        {label}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Typing panel                                                               */
/* -------------------------------------------------------------------------- */

function TypingPanel(): ReactNode {
  const { state, handleType, reset } = useTypingTest();
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState<boolean>(false);

  const focusInput = useCallback(() => inputRef.current?.focus(), []);

  useEffect(() => {
    // Autofocus so a visitor can just start typing.
    focusInput();
  }, [focusInput]);

  const seconds = (state.elapsedMs / 1000).toFixed(1);

  const chars = useMemo(() => {
    return state.target.split("").map((char, i) => {
      const typedChar = state.typed[i];
      const isCurrent = i === state.typed.length;
      let tone = "text-[#4B535B]"; // untyped
      let bg = "";
      if (typedChar != null) {
        tone = typedChar === char ? "text-[#E7EAED]" : "text-[#F26D6D]";
        if (typedChar !== char) bg = "bg-[#F26D6D]/10 rounded-[3px]";
      }
      return (
        <span key={i} className={classNames("relative", tone, bg)}>
          {isCurrent && focused ? (
            <span
              aria-hidden
              className="absolute -left-[1px] top-[2px] bottom-[2px] w-[2px] animate-[blink_1.05s_steps(1)_infinite] bg-[#F2C14E]"
            />
          ) : null}
          {char === " " ? " " : char}
        </span>
      );
    });
  }, [state.target, state.typed, focused]);

  return (
    <div className="relative">
      <div
        className="rounded-2xl border border-[#1E2329] bg-[#101316] p-6 shadow-[0_1px_0_0_#22262B_inset,0_30px_60px_-30px_rgba(0,0,0,0.8)] sm:p-8"
        onClick={focusInput}
      >
        {/* Panel header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PaceLights />
            <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#79828B]">
              Single player · time trial
            </span>
          </div>
          <span
            className={classNames(
              "font-mono text-[11px] uppercase tracking-[0.16em]",
              state.status === "running"
                ? "text-[#F2C14E]"
                : state.status === "finished"
                ? "text-[#4ADE80]"
                : "text-[#4B535B]"
            )}
          >
            {state.status === "running"
              ? "on the clock"
              : state.status === "finished"
              ? "finished"
              : "ready"}
          </span>
        </div>

        {/* The text to type */}
        <p className="select-none font-mono text-lg leading-[2.1rem] tracking-tight sm:text-xl sm:leading-[2.4rem]">
          {chars}
        </p>

        {/* Hidden capture input */}
        <input
          ref={inputRef}
          value={state.typed}
          onChange={(e) => handleType(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={state.status === "finished"}
          className="sr-only"
          aria-label="Type the text shown above"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />

        {/* Progress rail */}
        <div className="mt-6 h-[3px] w-full overflow-hidden rounded-full bg-[#1E2329]">
          <div
            className="h-full rounded-full bg-[#F2C14E] transition-[width] duration-150 ease-out"
            style={{ width: `${state.progress * 100}%` }}
          />
        </div>

        {/* Not-focused nudge */}
        {!focused && state.status !== "finished" ? (
          <button
            type="button"
            onClick={focusInput}
            className="mt-5 w-full rounded-lg border border-dashed border-[#2A2F35] py-2 text-center text-xs text-[#79828B] transition-colors hover:border-[#F2C14E]/40 hover:text-[#E7EAED]"
          >
            Click here or start typing to begin
          </button>
        ) : null}

        {/* Stats + controls */}
        <div className="mt-7 flex flex-wrap items-end justify-between gap-6">
          <div className="flex items-end gap-8">
            <Stat label="WPM" value={state.wpm} emphasis />
            <Stat label="Accuracy" value={state.accuracy} unit="%" />
            <Stat label="Time" value={seconds} unit="s" />
          </div>

          <div className="flex items-center gap-2">
            {state.status === "finished" ? (
              <span className="mr-1 hidden font-mono text-xs text-[#4ADE80] sm:inline">
                {state.wpm} wpm · {state.accuracy}% clean
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => {
                reset(false);
                focusInput();
              }}
              className="rounded-lg border border-[#2A2F35] px-3 py-2 text-xs text-[#B8BFC6] transition-colors hover:border-[#3A4048] hover:text-[#E7EAED]"
            >
              Restart
            </button>
            <button
              type="button"
              onClick={() => {
                reset(true);
                focusInput();
              }}
              className="rounded-lg bg-[#F2C14E] px-3 py-2 text-xs font-semibold text-[#0A0B0D] transition-transform hover:brightness-110 active:scale-[0.97]"
            >
              New text
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Auth modal                                                                 */
/* -------------------------------------------------------------------------- */

function AuthModal({
  mode,
  onClose,
  onSwitch,
  onGuest,
}: {
  mode: AuthMode;
  onClose: () => void;
  onSwitch: (tab: AuthTab) => void;
  onGuest: () => void;
}): ReactNode {
  const open = mode !== null;
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  const isSignup = mode === "signup";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isSignup ? "Create account" : "Sign in"}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        className="relative w-full max-w-sm rounded-2xl border border-[#1E2329] bg-[#101316] p-7 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]"
      >
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <PaceLights />
            <span className="font-mono text-sm font-semibold tracking-tight text-[#E7EAED]">
              Typing Racer
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-[#79828B] transition-colors hover:bg-[#1A1E23] hover:text-[#E7EAED]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Tab switch */}
        <div className="mb-6 grid grid-cols-2 rounded-lg border border-[#1E2329] bg-[#0A0B0D] p-1">
          {(["signup", "signin"] as const).map((tab) => {
            const active = mode === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onSwitch(tab)}
                className={classNames(
                  "rounded-md py-2 text-xs font-medium transition-colors",
                  active
                    ? "bg-[#1A1E23] text-[#E7EAED]"
                    : "text-[#79828B] hover:text-[#B8BFC6]"
                )}
              >
                {tab === "signup" ? "Create account" : "Sign in"}
              </button>
            );
          })}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            // Wire this to your auth backend.
            onClose();
          }}
          className="space-y-4"
        >
          {isSignup ? (
            <Field label="Username" name="username" type="text" placeholder="racer_01" />
          ) : null}
          <Field label="Email" name="email" type="email" placeholder="you@example.com" />
          <Field
            label="Password"
            name="password"
            type="password"
            placeholder="••••••••"
          />

          <button
            type="submit"
            className="mt-2 w-full rounded-lg bg-[#F2C14E] py-2.5 text-sm font-semibold text-[#0A0B0D] transition-transform hover:brightness-110 active:scale-[0.99]"
          >
            {isSignup ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-[#4B535B]">
          <span className="h-px flex-1 bg-[#1E2329]" />
          or
          <span className="h-px flex-1 bg-[#1E2329]" />
        </div>

        <button
          type="button"
          onClick={onGuest}
          className="w-full rounded-lg border border-[#2A2F35] py-2.5 text-sm text-[#B8BFC6] transition-colors hover:border-[#3A4048] hover:text-[#E7EAED]"
        >
          Play as guest
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type,
  placeholder,
}: {
  label: string;
  name: string;
  type: string;
  placeholder: string;
}): ReactNode {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-[0.16em] text-[#79828B]">
        {label}
      </span>
      <input
        name={name}
        type={type}
        required
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg border border-[#22262B] bg-[#0A0B0D] px-3 py-2.5 text-sm text-[#E7EAED] placeholder:text-[#3A4048] outline-none transition-colors focus:border-[#F2C14E]/60 focus:ring-1 focus:ring-[#F2C14E]/30"
      />
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function TypingRacerLanding(): ReactNode {
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [guest, setGuest] = useState<boolean>(false);

  const startGuest = useCallback(() => {
    setGuest(true);
    setAuthMode(null);
    // Scroll to the playable test.
    document
      .getElementById("play")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  return (
    <main className="min-h-screen bg-[#0A0B0D] text-[#E7EAED] antialiased [font-family:ui-sans-serif,system-ui,-apple-system,'Segoe_UI',sans-serif]">
      {/* Keyframes for the caret + reduced-motion guard */}
      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
        }
      `}</style>

      {/* Ambient grid glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.5]"
        style={{
          background:
            "radial-gradient(600px 400px at 70% -10%, rgba(242,193,78,0.06), transparent 60%)",
        }}
      />

      {/* Header */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <PaceLights />
          <span className="font-mono text-sm font-semibold tracking-tight">
            Typing<span className="text-[#F2C14E]">Racer</span>
          </span>
        </div>
        <nav className="flex items-center gap-2">
          {guest ? (
            <span className="mr-1 hidden font-mono text-xs text-[#79828B] sm:inline">
              guest mode
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setAuthMode("signin")}
            className="rounded-lg px-3 py-2 text-sm text-[#B8BFC6] transition-colors hover:text-[#E7EAED]"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setAuthMode("signup")}
            className="rounded-lg bg-[#F2C14E] px-3.5 py-2 text-sm font-semibold text-[#0A0B0D] transition-transform hover:brightness-110 active:scale-[0.98]"
          >
            Create account
          </button>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-10 pt-10 sm:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          {/* Left: pitch */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#1E2329] bg-[#101316] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#79828B]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4ADE80]" />
              Race live · or train solo
            </span>

            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Type faster.
              <br />
              <span className="text-[#F2C14E]">Win the race.</span>
            </h1>

            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[#8A9299]">
              A minimalist speed-typing arena. Line up against other racers in
              real time, or run a solo time trial to sharpen your pace. Every
              keystroke counts.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setAuthMode("signup")}
                className="rounded-xl bg-[#F2C14E] px-5 py-3 text-sm font-semibold text-[#0A0B0D] transition-transform hover:brightness-110 active:scale-[0.98]"
              >
                Create account
              </button>
              <button
                type="button"
                onClick={startGuest}
                className="rounded-xl border border-[#2A2F35] px-5 py-3 text-sm text-[#E7EAED] transition-colors hover:border-[#3A4048]"
              >
                Play as guest
              </button>
              <a
                href="#play"
                className="rounded-xl px-4 py-3 text-sm text-[#8A9299] transition-colors hover:text-[#E7EAED]"
              >
                Single player →
              </a>
            </div>

            <dl className="mt-10 flex gap-8 border-t border-[#1E2329] pt-6">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.18em] text-[#79828B]">
                  Live races
                </dt>
                <dd className="mt-1 font-mono text-lg text-[#E7EAED]">1v1 – 8</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.18em] text-[#79828B]">
                  Solo mode
                </dt>
                <dd className="mt-1 font-mono text-lg text-[#E7EAED]">no signup</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.18em] text-[#79828B]">
                  Tracked
                </dt>
                <dd className="mt-1 font-mono text-lg text-[#E7EAED]">wpm · acc</dd>
              </div>
            </dl>
          </div>

          {/* Right: the live, playable test */}
          <div id="play" className="scroll-mt-24">
            <TypingPanel />
          </div>
        </div>
      </section>

      {/* Modes strip */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-4 sm:grid-cols-3">
          <ModeCard
            index="Solo"
            title="Single player"
            body="A distraction-free time trial. Just you, the text, and your WPM. No account needed."
            action="Start typing"
            onClick={() => {
              document
                .getElementById("play")
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          />
          <ModeCard
            index="Guest"
            title="Play as guest"
            body="Jump into a race instantly. Your scores stay on this device until you sign up."
            action="Play as guest"
            onClick={startGuest}
          />
          <ModeCard
            index="Account"
            title="Create account"
            body="Save your stats, climb the leaderboard, and challenge friends to head-to-head races."
            action="Create account"
            highlight
            onClick={() => setAuthMode("signup")}
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 border-t border-[#1E2329] px-6 py-8 text-xs text-[#79828B] sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <PaceLights />
          <span className="font-mono">TypingRacer</span>
        </div>
        <span>Built for people who like the sound of a keyboard.</span>
      </footer>

      {/* Auth modal */}
      <AuthModal
        mode={authMode}
        onClose={() => setAuthMode(null)}
        onSwitch={(tab) => setAuthMode(tab)}
        onGuest={startGuest}
      />
    </main>
  );
}

function ModeCard({
  index,
  title,
  body,
  action,
  onClick,
  highlight,
}: {
  index: string;
  title: string;
  body: string;
  action: string;
  onClick: () => void;
  highlight?: boolean;
}): ReactNode {
  return (
    <div
      className={classNames(
        "group flex flex-col rounded-2xl border bg-[#101316] p-6 transition-colors",
        highlight
          ? "border-[#F2C14E]/30 hover:border-[#F2C14E]/60"
          : "border-[#1E2329] hover:border-[#2A2F35]"
      )}
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#79828B]">
        {index}
      </span>
      <h3 className="mt-3 text-lg font-semibold text-[#E7EAED]">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-[#8A9299]">{body}</p>
      <button
        type="button"
        onClick={onClick}
        className={classNames(
          "mt-5 self-start text-sm font-medium transition-colors",
          highlight
            ? "text-[#F2C14E] hover:brightness-110"
            : "text-[#B8BFC6] hover:text-[#E7EAED]"
        )}
      >
        {action} →
      </button>
    </div>
  );
}