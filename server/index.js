const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const initSocket = require("./socket");

const app = express();
const server = http.createServer(app);  // Create a raw HTTP server, wrapping the Express app
const io = new Server(server, { // Attach Socket.IO to that same HTTP server
  cors: {
    origin: "*", // restrict this to your frontend URL in production
    methods: ["GET", "POST"],
  },
});

// Your normal Express routes still work as usual
app.get("/", (req, res) => {
  res.send("Server is running");
});

initSocket(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});