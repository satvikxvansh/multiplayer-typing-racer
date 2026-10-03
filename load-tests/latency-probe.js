// load-tests/latency-probe.js
const fs = require("fs");
const path = require("path");
const { io } = require("socket.io-client");

const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const MAX_SAMPLES = 60;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (p, ms, label) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(label)), ms))]);

async function main() {
  console.log(`Target: ${BASE_URL}`);
  const res = await fetch(`${BASE_URL}/api/rooms`, { method: "POST" });
  const { roomId } = await res.json();
  console.log(`Created room: ${roomId}`);

  // Create 4 racer sockets (rooms require 4 players to start the countdown)
  const sockets = Array.from({ length: 4 }, () =>
    io(BASE_URL, { transports: ["websocket"] })
  );
  const [a, b] = sockets;

  try {
    // Wait for all 4 sockets to connect
    await Promise.all(sockets.map((s) => new Promise((r) => s.on("connect", r))));

    // All 4 join the room
    sockets.forEach((s) => s.emit("join_room", roomId));
    await wait(500);

    // Wait for race_start
    const started = new Promise((r) => a.once("race_start", r));

    // All 4 ready up to trigger 4-player countdown
    sockets.forEach((s) => s.emit("player_ready", roomId));
    console.log("Racers readied up, waiting for countdown and race_start...");

    const { passage } = await withTimeout(started, 30000, "race_start never arrived");
    console.log(`Race started! Passage length: ${passage.length}. Probing typing latency...`);

    const latencies = [];
    const n = Math.min(MAX_SAMPLES, passage.length - 1);

    for (let i = 1; i <= n; i++) {
      const t = Date.now();
      const got = new Promise((resolve) => {
        const h = ({ socketId }) => {
          if (socketId === a.id) {
            b.off("opponent_progress", h);
            resolve();
          }
        };
        b.on("opponent_progress", h);
      });

      a.emit("typing_progress", {
        roomId,
        typedText: passage.slice(0, i),
        timestamp: t,
      });

      try {
        await withTimeout(got, 5000, "timeout");
        latencies.push(Date.now() - t);
      } catch {
        console.log(`sample ${i} dropped`);
      }
      await wait(100);
    }

    if (latencies.length === 0) {
      console.log("No latency samples were captured.");
      return;
    }

    latencies.sort((x, y) => x - y);
    const pct = (p) =>
      latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))];

    console.log(
      `\n--- Latency Results ---\n` +
      `samples=${latencies.length}/${n}  ` +
      `min=${latencies[0]}ms  ` +
      `median=${pct(0.5)}ms  ` +
      `p95=${pct(0.95)}ms  ` +
      `max=${latencies[latencies.length - 1]}ms`
    );
  } finally {
    sockets.forEach((s) => s.disconnect());
  }
}

main().catch((e) => {
  console.error("Probe error:", e.message);
  process.exit(1);
});