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
 * Aligns a single typed word with its target word in the passage using LCS.
 * Matches common characters, identifies extra typed characters, and flags omitted characters.
 */
function alignSingleWord(targetWord: string, typedWord: string, isPastWord: boolean) {
  if (targetWord === typedWord) {
    return {
      correctCount: targetWord.length,
      incorrectCount: 0,
      charStates: new Array<"correct" | "incorrect" | "pending">(targetWord.length).fill("correct"),
      hasMistake: false,
    };
  }

  const tLen = typedWord.length;
  const pLen = targetWord.length;

  const dp: number[][] = Array.from({ length: tLen + 1 }, () => new Array(pLen + 1).fill(0));
  for (let i = 1; i <= tLen; i++) {
    for (let j = 1; j <= pLen; j++) {
      if (typedWord[i - 1] === targetWord[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const matchedTarget = new Set<number>();
  let i = tLen;
  let j = pLen;
  while (i > 0 && j > 0) {
    if (typedWord[i - 1] === targetWord[j - 1]) {
      matchedTarget.add(j - 1);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  const correctCount = matchedTarget.size;
  let incorrectCount = 0;
  let hasMistake = false;

  const extraTyped = Math.max(0, tLen - matchedTarget.size);
  incorrectCount += extraTyped;
  if (extraTyped > 0) hasMistake = true;

  let furthestTarget = 0;
  for (const idx of matchedTarget) {
    furthestTarget = Math.max(furthestTarget, idx + 1);
  }
  furthestTarget = Math.min(pLen, Math.max(furthestTarget, tLen));

  const charStates: ("correct" | "incorrect" | "pending")[] = [];
  for (let c = 0; c < pLen; c++) {
    if (matchedTarget.has(c)) {
      charStates.push("correct");
    } else if (c < furthestTarget || isPastWord) {
      charStates.push("incorrect");
      incorrectCount++;
      hasMistake = true;
    } else {
      charStates.push("pending");
    }
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

  let correctChars = 0;
  let incorrectChars = 0;
  let progressChars = 0;
  const mistypedWords: string[] = [];
  const charStates: CharState[] = [];

  let activeCaretIndex = -1;

  for (let w = 0; w < passageWords.length; w++) {
    const targetWord = passageWords[w];
    const isPastWord = w < typedWords.length - 1;
    const isCurrentWord = w === typedWords.length - 1;
    const isFutureWord = w >= typedWords.length;

    const typedWord = isFutureWord ? "" : typedWords[w];

    const wordResult = alignSingleWord(targetWord, typedWord, isPastWord);

    correctChars += wordResult.correctCount;
    incorrectChars += wordResult.incorrectCount;

    if (wordResult.hasMistake && (isPastWord || typedWord.length >= targetWord.length)) {
      mistypedWords.push(targetWord);
    }

    // Append char states for this word
    for (let c = 0; c < targetWord.length; c++) {
      const state = wordResult.charStates[c];
      const charIndex = charStates.length;
      let isCaret = false;

      if (isCurrentWord && c === Math.min(typedWord.length, targetWord.length) && activeCaretIndex === -1) {
        isCaret = true;
        activeCaretIndex = charIndex;
      }

      charStates.push({ char: targetWord[c], state, isCaret });
    }

    // Space after word
    if (w < passageWords.length - 1) {
      let spaceState: "correct" | "incorrect" | "pending" = "pending";
      let isSpaceCaret = false;

      if (isPastWord) {
        spaceState = "correct";
        correctChars++;
      } else if (isCurrentWord && typedWord.length >= targetWord.length && activeCaretIndex === -1) {
        isSpaceCaret = true;
        activeCaretIndex = charStates.length;
      }

      charStates.push({ char: " ", state: spaceState, isCaret: isSpaceCaret });
    }

    // Progress characters
    if (isPastWord) {
      progressChars += targetWord.length + (w < passageWords.length - 1 ? 1 : 0);
    } else if (isCurrentWord) {
      progressChars += Math.min(typedWord.length, targetWord.length);
    }
  }

  let progressPercent = Math.min(100, Math.round((progressChars / passage.length) * 100));

  const lastTarget = passageWords[passageWords.length - 1];
  const lastTyped = typedWords[passageWords.length - 1] ?? "";
  const isFinished =
    typedWords.length > passageWords.length ||
    (typedWords.length === passageWords.length && lastTyped.length >= lastTarget.length) ||
    progressChars >= passage.length;

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
