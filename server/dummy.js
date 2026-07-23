const { createRoom, getRoom, addRacerToRoom } = require("../server/rooms");
const { startCountdown } = require("../server/raceEngine");
const { calculateProgress, calculateWpm } = require("../server/validation");

function initSocket(io) {
  io.on("connection", (socket) => {
    socket.on("join_room", (roomId) => {
      const room = getRoom(roomId);
      if (!room) {
        socket.emit("error_message", "Room does not exist");
        return;
      }

      socket.join(roomId);
      addRacerToRoom(roomId, socket.id);
      io.to(roomId).emit("room_state", room);
    });

    socket.on("player_ready", (roomId) => {
      const room = getRoom(roomId);
      if (!room) return;

      // TODO(you): only call this once ALL racers are ready, not on the first one
      startCountdown(io, roomId);
    });

    socket.on("typing_progress", ({ roomId, typedText, timestamp }) => {
      const room = getRoom(roomId);
      if (!room) return;

      const racer = room.racers.find((r) => r.socketId === socket.id);
      if (!racer || racer.finished) return;

      const { progressPercent, isFinished, correctChars } = calculateProgress(
        typedText,
        room.passage
      );
      racer.progressPercent = progressPercent;
      racer.wpm = calculateWpm(correctChars, room.startTimestamp);

      io.to(roomId).emit("opponent_progress", {
        socketId: socket.id,
        progressPercent,
        wpm: racer.wpm,
      });

      if (isFinished) {
        racer.finished = true;
        racer.finishTimeMs = timestamp;
        io.to(roomId).emit("player_finished", {
          socketId: socket.id,
          finishTimeMs: timestamp,
          placement: room.racers.filter((r) => r.finished).length,
        });
      }
    });

    socket.on("disconnect", () => {
      // TODO(you): remove/mark racer as disconnected in their room
    });
  });
}

module.exports = initSocket;