export interface CharState {
  char: string;
  state: "correct" | "incorrect" | "pending";
  isCaret: boolean;
}

export interface ProgressResult {
  progressPercent: number;
  isFinished: boolean;
  correctChars: number;
  incorrectChars: number;
  mistypedWords: string[];
  charStates: CharState[];
}

/**
 * Standard word-by-word typing alignment:
 * Evaluates characters at matching indices within each word.
 * Untyped characters in the current word are always "pending" (never marked incorrect/red).
 */
function alignSingleWord(targetWord: string, typedWord: string, isPastWord: boolean) {
  let correctCount = 0;
  let incorrectCount = 0;
  let hasMistake = false;
  const charStates: ("correct" | "incorrect" | "pending")[] = [];

  for (let c = 0; c < targetWord.length; c++) {
    if (c < typedWord.length) {
      if (typedWord[c] === targetWord[c]) {
        charStates.push("correct");
        correctCount++;
      } else {
        charStates.push("incorrect");
        incorrectCount++;
        hasMistake = true;
      }
    } else {
      if (isPastWord) {
        charStates.push("incorrect");
        incorrectCount++;
        hasMistake = true;
      } else {
        charStates.push("pending");
      }
    }
  }

  if (typedWord.length > targetWord.length) {
    const extra = typedWord.length - targetWord.length;
    incorrectCount += extra;
    hasMistake = true;
  }

  return { correctCount, incorrectCount, charStates, hasMistake };
}

export function calculateProgress(typedText: string, passage: string): ProgressResult {
  if (!passage) {
    return {
      progressPercent: 0,
      isFinished: false,
      correctChars: 0,
      incorrectChars: 0,
      mistypedWords: [],
      charStates: [],
    };
  }

  const passageWords = passage.trim().split(/\s+/);
  const typedWords = typedText.length > 0 ? typedText.split(" ") : [""];
  const currentWordIndex = typedWords.length - 1;

  let correctChars = 0;
  let incorrectChars = 0;
  let progressChars = 0;
  const mistypedWords: string[] = [];
  const charStates: CharState[] = [];

  let caretAssigned = false;

  for (let w = 0; w < passageWords.length; w++) {
    const targetWord = passageWords[w];
    const isPastWord = w < currentWordIndex;
    const isCurrentWord = w === currentWordIndex;
    const isFutureWord = w > currentWordIndex;

    const typedWord = isFutureWord ? "" : (typedWords[w] ?? "");

    const wordResult = alignSingleWord(targetWord, typedWord, isPastWord);

    correctChars += wordResult.correctCount;
    incorrectChars += wordResult.incorrectCount;

    if (wordResult.hasMistake && (isPastWord || typedWord.length >= targetWord.length)) {
      mistypedWords.push(targetWord);
    }

    // Append character states for this word
    for (let c = 0; c < targetWord.length; c++) {
      const state = wordResult.charStates[c];
      let isCaret = false;

      if (isCurrentWord && c === typedWord.length && !caretAssigned) {
        isCaret = true;
        caretAssigned = true;
      }

      charStates.push({ char: targetWord[c], state, isCaret });
    }

    // Space after word
    if (w < passageWords.length - 1) {
      let spaceState: "correct" | "incorrect" | "pending" = "pending";
      let isSpaceCaret = false;

      if (isCurrentWord && typedWord.length >= targetWord.length && !caretAssigned) {
        isSpaceCaret = true;
        caretAssigned = true;
      }

      if (isPastWord) {
        spaceState = "correct";
        correctChars++;
      }

      charStates.push({ char: " ", state: spaceState, isCaret: isSpaceCaret });
    }

    // Progress characters: advance smoothly as words/characters are typed
    if (isPastWord) {
      progressChars += targetWord.length + (w < passageWords.length - 1 ? 1 : 0);
    } else if (isCurrentWord) {
      progressChars += Math.min(typedWord.length, targetWord.length);
    }
  }

  const lastTarget = passageWords[passageWords.length - 1];
  const lastTyped = typedWords[passageWords.length - 1] ?? "";
  const isFinished =
    typedWords.length > passageWords.length ||
    (typedWords.length === passageWords.length && lastTyped.length >= lastTarget.length) ||
    progressChars >= passage.length;

  let progressPercent = passage.length > 0 ? Math.min(100, Math.round((progressChars / passage.length) * 100)) : 0;
  if (isFinished) {
    progressPercent = 100;
  }

  return {
    progressPercent,
    isFinished,
    correctChars,
    incorrectChars,
    mistypedWords: [...new Set(mistypedWords)].slice(0, 5),
    charStates,
  };
}

export function calculateWpm(correctChars: number, startTimestamp: number | null): number {
  if (!startTimestamp) return 0;
  const elapsedMinutes = (Date.now() - startTimestamp) / 60000;
  if (elapsedMinutes <= 0) return 0;
  const words = correctChars / 5;
  return Math.round(words / elapsedMinutes);
}
