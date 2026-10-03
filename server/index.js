const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const initSocket = require("./socket");
const { rooms } = require("./server/rooms");
const cors = require('cors');
require('dotenv').config(); 

const app = express();
const server = http.createServer(app);  // Create a raw HTTP server, wrapping the Express app

const corsOptions = {
  origin: process.env.CORS_ORIGIN,
  methods: 'GET,POST,PUT,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
const io = new Server(server, { // Attach Socket.IO to that same HTTP server
  cors: {
    origin: process.env.CORS_ORIGIN || "*", // restrict this to your frontend URL in production
    methods: ["GET", "POST"],
  },
  transports: ["websocket"],
});
const { createRoom } = require("./server/rooms");

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.post("/api/rooms", (req, res) => {
  const roomId = createRoom();
  res.json({ roomId });
  // TODO(you): maybe store initial room metadata in memory/DB here
  // (e.g. { roomId, maxRacers: 4, status: "waiting", createdAt: Date.now() })
});

app.get("/debug/memory", (req, res) => {
  if (req.query.key !== process.env.DEBUG_KEY) {
    return res.status(403).send("Forbidden");
  }
  const mem = process.memoryUsage();
  res.json({
    timestamp: Date.now(),
    rssMB: Math.round(mem.rss / 1024 / 1024),
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    roomCount: rooms.size, // direct evidence of the leak, independent of raw memory
  });
});

initSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});