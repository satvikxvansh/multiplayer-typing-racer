// load-tests/poll-memory.js
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const DEBUG_KEY = process.env.DEBUG_KEY || "debug";
const samples = [];

async function poll() {
  try {
    const res = await fetch(`${BASE_URL}/debug/memory?key=${DEBUG_KEY}`);
    if (!res.ok) {
      const text = await res.text();
      console.error(`poll failed: ${res.status} — ${text.slice(0, 100)}`);
      return;
    }
    const data = await res.json();
    samples.push(data);
    console.log(`${new Date(data.timestamp).toISOString()}  rss=${data.rssMB}MB  heap=${data.heapUsedMB}MB  rooms=${data.roomCount}  conns=${data.connections ?? 0}`);
    fs.writeFileSync("memory-samples.json", JSON.stringify(samples, null, 2));
  } catch (err) {
    console.error("poll failed:", err.message);
  }
}

setInterval(poll, 5000);
poll();