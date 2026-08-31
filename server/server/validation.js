function calculateProgress(typedText, passage) {
  let correctChars = 0;
  let incorrectChars = 0;

  for (let i = 0; i < typedText.length; i++) {
    if (typedText[i] === passage[i]) correctChars++;
    else incorrectChars++;
  }

  const progressPercent = (typedText.length / passage.length) * 100;
  const isFinished = typedText.length >= passage.length;

  return { progressPercent, isFinished, correctChars, incorrectChars };
}

function calculateWpm(correctChars, startTimestamp) {
  const elapsedMinutes = (Date.now() - startTimestamp) / 60000;
  if (elapsedMinutes <= 0) return 0;
  const words = correctChars / 5; // standard WPM convention: 5 chars = 1 word
  return Math.round(words / elapsedMinutes);
}

function getMistypedWords(typedText, passage) {
  const typedWords = typedText.trim().split(/\s+/);
  const passageWords = passage.trim().split(/\s+/);

  const mistyped = [];
  for (let i = 0; i < typedWords.length; i++) {
    if (typedWords[i] !== passageWords[i]) {
      mistyped.push(passageWords[i]);
    }
  }
  return [...new Set(mistyped)].slice(0, 5); // unique, capped so the prompt stays small
}

module.exports = { calculateProgress, calculateWpm, getMistypedWords };