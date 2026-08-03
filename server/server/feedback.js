async function generateFeedback({ wpm, accuracy, mistypedWords }) {
  const prompt = `A user just finished a typing race. Stats: ${wpm} WPM, ${accuracy}% accuracy. Commonly mistyped words: ${mistypedWords.length ? mistypedWords.join(", ") : "none"}. Give exactly 2 short, encouraging, specific tips to improve. Under 40 words total. Plain text only, no markdown, no preamble.`;

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
    // console.log(data.candidates[0].content);
    // return data.candidates[0].content;
    return data.candidates[0].content.parts[0].text ?? "Nice race!";
  } catch (err) {
    console.error("Feedback generation failed:", err);
    return "Nice race! Keep practicing to build speed and accuracy."; // graceful fallback
  }
}

module.exports = { generateFeedback };