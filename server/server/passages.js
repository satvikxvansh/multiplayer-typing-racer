// const PASSAGES = [
//   "The old wooden clock on the mantle ticked softly, marking the slow passage of a quiet afternoon.",
// ]
const PASSAGES = [
  "The old wooden clock.",
]

function pickRandomPassage(io, roomId) {
  return PASSAGES.at(0);
}

module.exports = { pickRandomPassage, PASSAGES };