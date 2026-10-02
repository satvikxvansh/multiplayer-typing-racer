"use client";

import { useMemo, useRef, useEffect } from "react";
import { calculateProgress } from "@/lib/validation";

interface TypingPassageProps {
  passage: string;
  typedText: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

/**
 * Renders the passage with per-character styling (correct / incorrect /
 * untyped) and a solid amber caret block riding just ahead of the typed
 * text — the page's signature detail, echoing the pace-light glow.
 */

export default function TypingPassage({
  passage,
  typedText,
  disabled,
  onChange,
}: TypingPassageProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [disabled]);

  const characters = useMemo(() => {
    return calculateProgress(typedText, passage).charStates;
  }, [passage, typedText]);


  return (
    <div
      className="relative cursor-text rounded-lg border border-[#1E2329] bg-[#101316] p-6"
      // onClick={() => inputRef.current?.focus()}
    >
      <p className="select-none whitespace-pre-wrap break-words font-mono text-lg leading-relaxed tracking-wide">
        {characters.map(({ char, state, isCaret }, i) => (
          <span key={i} className="relative">
            {isCaret && !disabled && (
              <span className="absolute -left-[1px] top-0 h-[1.2em] w-[2px] bg-[#F2C14E]" />
            )}
            <span
              className={
                state === "correct"
                  ? "text-[#F2C14E]/90"
                  : state === "incorrect"
                  ? "bg-[#F2C14E]/20 text-red-400 underline decoration-red-400"
                  : "text-[#8A9099]"
              }
            >
              {char}
            </span>
          </span>
        ))}
      </p>

      {/*
        Visually hidden but real <input>, kept off-screen rather than
        opacity:0-in-place, so it never intercepts clicks meant for the
        passage above. A real input (not manual keydown tracking) so IME
        composition, paste, and mobile keyboards behave correctly.
      */}
      <input
        ref={inputRef}
        value={typedText}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (!disabled) inputRef.current?.focus(); // snap focus back mid-race
        }}
        onPaste={(e) => e.preventDefault()}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="absolute -left-full h-0 w-0 opacity-0"
        aria-label="Typing input"
      />
    </div>
  );
}