// load-tests/setup-rooms.js
// Pre-creates a pool of rooms via the REST endpoint and writes their IDs
// to rooms.csv, so multiple simulated racers can land in the SAME room —
// exercising broadcast/contention logic, not just isolated connections.

const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const ROOM_COUNT = parseInt(process.env.ROOM_COUNT || "50", 10);

async function main() {
  const roomIds = [];

  for (let i = 0; i < ROOM_COUNT; i++) {
    const res = await fetch(`${BASE_URL}/api/rooms`, { method: "POST" });
    const { roomId } = await res.json();
    roomIds.push(roomId);
    if ((i + 1) % 10 === 0) console.log(`Created ${i + 1}/${ROOM_COUNT}`);
  }

  fs.writeFileSync("rooms.csv", "roomId\n" + roomIds.join("\n"));
  console.log(`Wrote ${roomIds.length} room IDs to rooms.csv`);
}

main();