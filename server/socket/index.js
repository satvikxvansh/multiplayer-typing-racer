const { rooms, getRoom, deleteRoom, addRacerToRoom } = require("../server/rooms");
const { startCountdown, cancelCountdown, checkRaceComplete } = require("../server/raceEngine");
const { calculateProgress, calculateWpm, getMistypedWords } = require("../server/validation");

function handleRacerLeave(io, socket, roomId) {
  const room = getRoom(roomId);
  if (!room) return;

  socket.leave(roomId);

  const racer = room.racers.find((r) => r.socketId === socket.id);
  if (!racer) return;

  if (room.status === "waiting") {
    // Remove racer from waiting room list
    room.racers = room.racers.filter((r) => r.socketId !== socket.id);

    // If no racers left in waiting room, delete room immediately!
    if (room.racers.length === 0) {
      deleteRoom(roomId);
      return;
    }

    io.to(roomId).emit("room_state", room);
    return;
  }

  if (room.status === "countdown") {
    racer.disconnected = true;
    const connectedRacers = room.racers.filter((r) => !r.disconnected);

    // If everyone left during countdown, delete room immediately (cancels countdown timer)
    if (connectedRacers.length === 0) {
      deleteRoom(roomId);
      return;
    }

    // If racers remain in countdown, abort countdown back to waiting room
    cancelCountdown(io, roomId);
    room.racers = connectedRacers;
    io.to(roomId).emit("room_state", room);
    return;
  }

  if (room.status === "racing") {
    if (!racer.finished) {
      racer.disconnected = true;
    }

    const connectedRacers = room.racers.filter((r) => !r.disconnected);

    // If all racers disconnected while racing, abort and delete room immediately!
    if (connectedRacers.length === 0) {
      deleteRoom(roomId);
      return;
    }

    // Otherwise notify remaining racers and check if the race is completed
    io.to(roomId).emit("room_state", room);
    checkRaceComplete(io, roomId);
    return;
  }

  if (room.status === "finished") {
    racer.disconnected = true;
    const anyConnected = room.racers.some((r) => !r.disconnected);

    // If all racers have left the finished room, delete room immediately
    if (!anyConnected) {
      deleteRoom(roomId);
    }
    return;
  }
}

function initSocket(io) {
  io.on("connection", (socket) => {
    socket.on("join_room", (roomId) => {
      const room = getRoom(roomId);
      if (!room) {
        socket.emit("error_message", "Room does not exist");
        return;
      }

      if (room.status === "finished") {
        socket.emit("error_message", "Race in this room has already finished");
        return;
      }

      socket.join(roomId);
      addRacerToRoom(roomId, socket.id);
      console.log(`${socket.id} joined room ${roomId}`);
      io.to(roomId).emit("room_state", room);
    });

    socket.on("leave_room", (roomId) => {
      handleRacerLeave(io, socket, roomId);
    });

    socket.on("player_ready", (roomId) => {
      const room = getRoom(roomId);
      if (!room || room.status !== "waiting") return;

      const joined = room.racers.length;
      console.log("Racers joined ", joined);

      // Start countdown once 2 racers have joined
      if (joined === 2) {
        startCountdown(io, roomId);
      }
    });

    socket.on("typing_progress", ({ roomId, typedText, timestamp }) => {
      const room = getRoom(roomId);
      if (!room || room.status !== "racing") return;

      const racer = room.racers.find((r) => r.socketId === socket.id);
      if (!racer || racer.finished) return;

      if (typedText.length < (racer.lastTypedLength ?? 0)) {
        racer.backspaces = (racer.backspaces ?? 0) + 1;
      }
      racer.lastTypedLength = typedText.length;

      const { progressPercent, isFinished, correctChars, incorrectChars } =
        calculateProgress(typedText, room.passage);

      racer.progressPercent = progressPercent;
      racer.correctChars = correctChars;
      racer.incorrectChars = incorrectChars;
      racer.wpm = calculateWpm(correctChars, room.startTimestamp);

      io.to(roomId).emit("opponent_progress", {
        socketId: socket.id,
        progressPercent,
        wpm: racer.wpm,
      });

      if (isFinished) {
        racer.finished = true;
        racer.finishTimeMs = timestamp;
        racer.mistypedWords = getMistypedWords(typedText, room.passage);

        io.to(roomId).emit("player_finished", {
          socketId: socket.id,
          finishTimeMs: timestamp,
          placement: room.racers.filter((r) => r.finished).length,
        });

        checkRaceComplete(io, roomId);
      }
    });

    socket.on("message", (data) => {
      io.emit("message", data);
    });

    socket.on("disconnect", () => {
      const snapshot = Array.from(rooms.values());
      for (const room of snapshot) {
        const hasRacer = room.racers.some((r) => r.socketId === socket.id);
        if (hasRacer) {
          handleRacerLeave(io, socket, room.roomId);
        }
      }
      console.log(socket.id, "Disconnected");
    });
  });
}

module.exports = initSocket;
module.exports.handleRacerLeave = handleRacerLeave;