function calculateProgress(typedText, passage) {
  let correctChars = 0;
  for (let i = 0; i < typedText.length; i++) {
    if (typedText[i] === passage[i]) correctChars++;
    else break; // stop at first mistake, or allow skip-ahead — your call
  }

  const progressPercent = (correctChars / passage.length) * 100;
  const isFinished = correctChars === passage.length;

  return { progressPercent, isFinished, correctChars };
}

function calculateWpm(correctChars, startTimestamp) {
  const elapsedMinutes = (Date.now() - startTimestamp) / 60000;
  if (elapsedMinutes <= 0) return 0;
  const words = correctChars / 5; // standard WPM convention: 5 chars = 1 word
  return Math.round(words / elapsedMinutes);
}

module.exports = { calculateProgress, calculateWpm };