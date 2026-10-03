require('dotenv').config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const initSocket = require("./socket");
const { rooms, createRoom } = require("./server/rooms");
const cors = require('cors');

const app = express();
const server = http.createServer(app);  // Create a raw HTTP server, wrapping the Express app

// Standardize CORS origin across Express and Socket.IO
const allowedOrigin = process.env.CORS_ORIGIN || "*";

const corsOptions = {
  origin: allowedOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(express.json());

const io = new Server(server, { // Attach Socket.IO to that same HTTP server
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"],
  },
  transports: ["websocket"],
});

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.post("/api/rooms", (req, res) => {
  const roomId = createRoom();
  res.json({ roomId });
});

app.get("/debug/memory", (req, res) => {
  // Guard: if DEBUG_KEY is unset or doesn't match query param, reject immediately
  if (!process.env.DEBUG_KEY || req.query.key !== process.env.DEBUG_KEY) {
    return res.status(403).send("Forbidden");
  }
  const mem = process.memoryUsage();
  res.json({
    timestamp: Date.now(),
    rssMB: Math.round(mem.rss / 1024 / 1024),
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    roomCount: rooms.size,
    connections: io.engine.clientsCount, // live connected sockets
  });
});

initSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});