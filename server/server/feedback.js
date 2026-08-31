async function generateFeedback(stats) {
  const { wpm, accuracy, duration, backspaces, mistypedWords, timeline } = stats;

  // summarize the timeline instead of dumping every point — keeps the prompt small
  const midPoint = Math.floor(timeline.length / 2);
  const firstHalfAvgWpm = average(timeline.slice(0, midPoint).map((t) => t.wpm));
  const secondHalfAvgWpm = average(timeline.slice(midPoint).map((t) => t.wpm));
  const pacingTrend = secondHalfAvgWpm > firstHalfAvgWpm ? "sped up" : secondHalfAvgWpm < firstHalfAvgWpm ? "slowed down" : "stayed steady";

  const prompt = `A user just finished a typing race. Stats: ${wpm} WPM, ${accuracy}% accuracy, ${duration}s duration, ${backspaces} backspaces. Pacing: they ${pacingTrend} over the course of the race (first half avg ${Math.round(firstHalfAvgWpm)} WPM vs second half ${Math.round(secondHalfAvgWpm)} WPM). Commonly mistyped words: ${mistypedWords.length ? mistypedWords.join(", ") : "none"}. Give exactly 2 short, encouraging, specific tips to improve. Under 40 words total. Plain text only, no markdown, no preamble.`;

  try {    
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",  {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();
    return data.candidates[0].content.parts[0].text ?? "Nice race!";
  } catch (err) {
    console.error("Feedback generation failed:", err);
    return "Nice race! Keep practicing to build speed and accuracy."; // graceful fallback
  }
}

function average(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, n) => sum + n, 0) / arr.length;
}

module.exports = { generateFeedback };