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

    

    socket.on("disconnect", () => {
      // TODO(you): remove/mark racer as disconnected in their room
    });
  });
}

module.exports = initSocket;