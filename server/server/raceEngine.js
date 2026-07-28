const { getRoom } = require("./rooms");
const { PASSAGES, pickRandomPassage } = require("./passages");

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

  io.to(roomId).emit("race_start", {
    passage: room.passage,
    startTimestamp: room.startTimestamp,
  }); 
}

function checkRaceComplete(io, roomId) {
  const room = getRoom(roomId);
  if (!room) return;

  const allFinished = room.racers.every((r) => r.finished || r.disconnected);
  if (!allFinished) return;

  room.status = "finished";

  const results = [...room.racers].sort(
    (a, b) => (a.finishTimeMs ?? Infinity) - (b.finishTimeMs ?? Infinity)
  );

  io.to(roomId).emit("race_finished", { results });

  // TODO(you): persist results to DB / update leaderboard here —
  // this is the one place it should happen, since it only fires once.
}

module.exports = { startCountdown, startRace, checkRaceComplete };