const PASSAGES = [
  "The old wooden clock on the mantle ticked softly, marking the slow passage of a quiet afternoon. Outside the window, a gentle breeze rustled the green leaves of the tall oak tree while a single stray cat wandered across the stone pathway.",
]

function pickRandomPassage(io, roomId) {
  return PASSAGES.at(0);
}

module.exports = { pickRandomPassage, PASSAGES };