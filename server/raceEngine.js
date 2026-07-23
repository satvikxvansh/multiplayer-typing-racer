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
  const startTimestamp = Date.now();

  io.to(roomId).emit("race_start", {
    passage: room.passage,
    startTimestamp,
  });
}

module.exports = { startCountdown, startRace };