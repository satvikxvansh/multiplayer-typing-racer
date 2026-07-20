function initSocket(io) {
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("join_room", (roomId) => {
      socket.join(roomId);
      console.log(`${socket.id} joined room ${roomId}`);

      // Let others in the room know someone joined
      socket.to(roomId).emit("user_joined", { socketId: socket.id });

      // Confirm to the user who just joined
      socket.emit("joined_room", { roomId });
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