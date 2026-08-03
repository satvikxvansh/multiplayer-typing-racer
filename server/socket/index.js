const { nanoid } = require("nanoid");

const { rooms, createRoom, getRoom, addRacerToRoom } = require("../server/rooms");
const { startCountdown, checkRaceComplete } = require("../server/raceEngine");
const { calculateProgress, calculateWpm, getMistypedWords  } = require("../server/validation");

function initSocket(io) {
  io.on("connection", (socket) => {

    socket.on("join_room", (roomId) => {
      const room = getRoom(roomId);
      if (!room) {
        socket.emit("error_message", "Room does not exist");
        return;
      }

      // if(!room.racers.find(racer => racer.socketId === socket.id)){
        socket.join(roomId);
      // }

      addRacerToRoom(roomId, socket.id);
      console.log(`${socket.id} joined room ${roomId}`);
      io.to(roomId).emit("room_state", room);
    });

    socket.on("player_ready", (roomId) => {
      const room = getRoom(roomId);
      if (!room) return;

      const joined = room.racers.length;
      console.log("Racers joined ", joined);

      // TODO(you): only call this once ALL racers are ready, not on the first one
      if(joined === 2){
        startCountdown(io, roomId);
      }
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

        checkRaceComplete(io, roomId);
      }

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
      for (const [roomId, room] of rooms) {
        const racer = room.racers.find((r) => r.socketId === socket.id);
        if (racer && !racer.finished) {
          racer.disconnected = true; // counts as "done, but didn't finish" for completion purposes
          io.to(roomId).emit("room_state", room);
          checkRaceComplete(io, roomId);
        }
      }
      console.log(socket.id, "Disconnected")
    });

  });
}

module.exports = initSocket;