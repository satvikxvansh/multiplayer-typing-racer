const { getRoom } = require("./rooms");
const { PASSAGES, pickRandomPassage } = require("./passages");
const { generateFeedback } = require("./feedback");

function buildRaceStats(racer, room) {
  const duration = racer.finishTimeMs
    ? Math.round((racer.finishTimeMs - room.startTimestamp) / 1000)
    : null;

  const totalTyped = racer.correctChars + racer.incorrectChars;
  const accuracy = totalTyped > 0 ? Math.round((racer.correctChars / totalTyped) * 100) : 100;

  return {
    wpm: racer.wpm,
    accuracy,
    duration,
    correctChars: racer.correctChars,
    incorrectChars: racer.incorrectChars,
    backspaces: racer.backspaces,
    mistypedWords: racer.mistypedWords ?? [],
    timeline: racer.timeline ?? [],
  };
}

function startCountdown(io, roomId) {
  const room = getRoom(roomId);
  if (!room) return;

  room.status = "countdown";
  let value = 3;

  const interval = setInterval(() => {
    io.to(roomId).emit("countdown_tick", value);
    value--;

    if (value < 0) {
      clearInterval(interval);
      startRace(io, roomId);
    }
  }, 1000);
}

function startRace(io, roomId) {
  const room = getRoom(roomId);
  if (!room) return;

  room.status = "racing";
  room.passage = pickRandomPassage();
  room.startTimestamp = Date.now();

  // reset per-race tracking on every racer
  room.racers.forEach((r) => {
    r.timeline = [];
    r.correctChars = 0;
    r.incorrectChars = 0;
    r.backspaces = 0;
    r.lastTypedLength = 0;
    r.mistypedWords = [];
  });

  io.to(roomId).emit("race_start", {
    passage: room.passage,
    startTimestamp: room.startTimestamp,
  });

  // snapshot every racer's state once a second while racing
  room.sampleInterval = setInterval(() => {
    const elapsedSeconds = Math.round((Date.now() - room.startTimestamp) / 1000);

    room.racers.forEach((r) => {
      const totalTyped = r.correctChars + r.incorrectChars;
      const accuracy = totalTyped > 0 ? Math.round((r.correctChars / totalTyped) * 100) : 100;

      r.timeline.push({
        second: elapsedSeconds,
        wpm: r.wpm,
        accuracy,
        progressPercent: r.progressPercent,
      });
    });
  }, 1000);

  // TODO(you): tie this to your RACE_TIME_LIMIT_SECONDS backstop timeout too
}

async function checkRaceComplete(io, roomId) {
  const room = getRoom(roomId);
  if (!room) return;

  const allFinished = room.racers.every((r) => r.finished || r.disconnected);
  if (!allFinished) return;

  clearInterval(room.sampleInterval); // stop sampling — race is over

  room.status = "finished";

  const results = [...room.racers].sort(
    (a, b) => (a.finishTimeMs ?? Infinity) - (b.finishTimeMs ?? Infinity)
  );

  io.to(roomId).emit("race_finished", { results });

  for (const racer of room.racers) {
    if (!racer.finished) continue;

    const stats = buildRaceStats(racer, room);

    // send the full stats + timeline privately to that racer, for the graph
    io.to(racer.socketId).emit("race_stats", stats);

    // same stats feed the AI feedback prompt
    generateFeedback(stats).then((feedback) => {
      io.to(racer.socketId).emit("race_feedback", { feedback });
    });
  }

  // TODO(you): persist results to DB / update leaderboard here —
  // this is the one place it should happen, since it only fires once.
}


module.exports = { startCountdown, startRace, checkRaceComplete };