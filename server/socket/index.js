const { nanoid } = require("nanoid");

const { createRoom, getRoom, addRacerToRoom } = require("../server/rooms");
const { startCountdown } = require("../server/raceEngine");
const { calculateProgress, calculateWpm } = require("../server/validation");

function initSocket(io) {
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("create_room", () => {
      const roomId = nanoid(6); // e.g. "a1B2c3"
      socket.join(roomId);
      socket.emit("room_created", { roomId }); // send the code back so they can share it
    });

    socket.on("join_room", (roomId) => {
      const room = getRoom(roomId);
      if (!room) {
        socket.emit("error_message", "Room does not exist");
        return;
      }

      socket.join(roomId);
      addRacerToRoom(roomId, socket.id);
      console.log(`${socket.id} joined room ${roomId}`);
      io.to(roomId).emit("room_state", room);
    });

    // socket.on("join_room", (roomId) => {

    //   socket.join(roomId);
    //   console.log(`${socket.id} joined room ${roomId}`);
    //   socket.to(roomId).emit("user_joined", { socketId: socket.id });
    //   socket.emit("joined_room", { roomId });
    // });

    socket.on("room_state", (state) => {
      
    });

    socket.on("message", (data) => {
      io.emit("message", data);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
}

module.exports = initSocket;