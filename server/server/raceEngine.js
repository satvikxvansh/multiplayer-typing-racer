const { getRoom, deleteRoom, ROOM_CLEANUP_DELAY_MS } = require("./rooms");
const { pickRandomPassage } = require("./passages");
const { generateFeedback } = require("./feedback");

const RACE_TIME_LIMIT_MS = 120 * 1000; // 2-minute backstop timeout for stalled races

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
  if (!room || room.status === "countdown" || room.status === "racing") return;

  if (room.countdownInterval) {
    clearInterval(room.countdownInterval);
    room.countdownInterval = null;
  }

  room.status = "countdown";
  let value = 3;
  room.countdownValue = value;

  room.countdownInterval = setInterval(() => {
    const currentRoom = getRoom(roomId);
    if (!currentRoom || currentRoom.status !== "countdown") {
      if (room.countdownInterval) {
        clearInterval(room.countdownInterval);
        room.countdownInterval = null;
      }
      return;
    }

    currentRoom.countdownValue = value;
    io.to(roomId).emit("countdown_tick", value);
    value--;

    if (value < 0) {
      clearInterval(currentRoom.countdownInterval);
      currentRoom.countdownInterval = null;
      currentRoom.countdownValue = null;
      startRace(io, roomId);
    }
  }, 1000);
}

function cancelCountdown(io, roomId) {
  const room = getRoom(roomId);
  if (!room || room.status !== "countdown") return;

  if (room.countdownInterval) {
    clearInterval(room.countdownInterval);
    room.countdownInterval = null;
  }
  room.status = "waiting";
  room.countdownValue = null;
}

function startRace(io, roomId) {
  const room = getRoom(roomId);
  if (!room) return;

  if (room.countdownInterval) {
    clearInterval(room.countdownInterval);
    room.countdownInterval = null;
  }
  if (room.sampleInterval) {
    clearInterval(room.sampleInterval);
    room.sampleInterval = null;
  }

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
    // const elapsedSeconds = Math.round((Date.now() - room.startTimestamp) / 1000);
    const currentRoom = getRoom(roomId);
    if (!currentRoom || currentRoom.status !== "racing") {
      if (room.sampleInterval) {
        clearInterval(room.sampleInterval);
        room.sampleInterval = null;
      }
      return;
    }

    // room.racers.forEach((r) => {
    const elapsedSeconds = Math.round((Date.now() - currentRoom.startTimestamp) / 1000);

    currentRoom.racers.forEach((r) => {
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

  // Authoritative backstop timeout to force finish the race if stalled
  if (room.raceTimeout) {
    clearTimeout(room.raceTimeout);
  }
  room.raceTimeout = setTimeout(() => {
    forceFinishRace(io, roomId);
  }, RACE_TIME_LIMIT_MS);
}

function forceFinishRace(io, roomId) {
  const room = getRoom(roomId);
  if (!room || room.status !== "racing") return;

  console.log(`Race in room ${roomId} timed out after limit. Force finishing.`);
  room.racers.forEach((racer) => {
    if (!racer.finished && !racer.disconnected) {
      racer.finished = true;
      racer.finishTimeMs = Date.now();
    }
  });

  checkRaceComplete(io, roomId);
}

async function checkRaceComplete(io, roomId) {
  const room = getRoom(roomId);
  if (!room || room.status === "finished") return;

  const allFinished = room.racers.length > 0 && room.racers.every((r) => r.finished || r.disconnected);
  if (!allFinished) return;

  // Stop sampling interval and race timeout
  if (room.sampleInterval) {
    clearInterval(room.sampleInterval);
    room.sampleInterval = null;
  }
  if (room.raceTimeout) {
    clearTimeout(room.raceTimeout);
    room.raceTimeout = null;
  }

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

  // If all racers have already disconnected, clean up immediately
  const hasConnectedRacers = room.racers.some((r) => !r.disconnected);
  if (!hasConnectedRacers) {
    deleteRoom(roomId);
    return;
  }

  // Otherwise, schedule post-race room cleanup so finished rooms don't linger forever
  if (room.cleanupTimeout) {
    clearTimeout(room.cleanupTimeout);
  }
  room.cleanupTimeout = setTimeout(() => {
    deleteRoom(roomId);
  }, ROOM_CLEANUP_DELAY_MS);
}

module.exports = {
  startCountdown,
  cancelCountdown,
  startRace,
  forceFinishRace,
  checkRaceComplete,
  RACE_TIME_LIMIT_MS,
};