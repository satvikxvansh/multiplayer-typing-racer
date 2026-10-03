// load-tests/setup-rooms.js
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const ROOM_COUNT = parseInt(process.env.ROOM_COUNT || "40", 10);
const BATCH_SIZE = 20; // concurrent requests per batch

async function createRoom() {
  const res = await fetch(`${BASE_URL}/api/rooms`, { method: "POST" });
  const { roomId } = await res.json();
  return roomId;
}

async function main() {
  const roomIds = [];

  for (let i = 0; i < ROOM_COUNT; i += BATCH_SIZE) {
    const batchSize = Math.min(BATCH_SIZE, ROOM_COUNT - i);
    const batch = await Promise.all(Array.from({ length: batchSize }, createRoom));
    roomIds.push(...batch);
    console.log(`Created ${roomIds.length}/${ROOM_COUNT}`);
  }

  fs.writeFileSync("rooms.csv", "roomId\n" + roomIds.join("\n"));
  console.log(`DONE — wrote ${roomIds.length} room IDs to rooms.csv`);
}

main();