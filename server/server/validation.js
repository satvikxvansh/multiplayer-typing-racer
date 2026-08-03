function calculateProgress(typedText, passage) {
  let correctChars = 0;
  let totalChars = 0;

  for (let i = 0; i < typedText.length; i++) {
    if (typedText[i] === passage[i]) correctChars++;
    totalChars++;
    // else break; // stop at first mistake, or allow skip-ahead — your call
  }

  const progressPercent = (totalChars / passage.length) * 100;
  const isFinished = totalChars === passage.length;

  return { progressPercent, isFinished, correctChars };
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