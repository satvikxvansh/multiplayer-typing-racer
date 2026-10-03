import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Counter, Rate } from "k6/metrics";

// Custom metrics for granular observability
const roomCreateDuration = new Trend("room_create_duration", true);
const roomsCreated = new Counter("rooms_created");
const roomSuccessRate = new Rate("room_success_rate");

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";

export const options = {
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
  stages: [
    { duration: "15s", target: 20 },  // 1. Warm-up: Ramp up to 20 VUs
    { duration: "45s", target: 50 },  // 2. Sustained Load: Hold at 50 concurrent VUs
    { duration: "20s", target: 120 }, // 3. Stress Spike: Ramp to 120 VUs
    { duration: "30s", target: 120 }, // 4. Peak Traffic: Hold at 120 VUs
    { duration: "15s", target: 0 },   // 5. Cooldown: Graceful ramp down
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],       // Less than 1% failure rate (99%+ reliability)
    http_req_duration: ["p(95)<800"],      // 95% under 800ms (accommodates transatlantic network transit)
    room_create_duration: ["p(95)<800"],   // Room allocation p95 under 800ms
    room_success_rate: ["rate>0.99"],      // 99%+ room creation success rate
  },
};

export default function () {
  // 90% room creation traffic, 10% health-check/landing page traffic
  if (Math.random() < 0.9) {
    const params = {
      headers: {
        "Content-Type": "application/json",
      },
      tags: { name: "create_room" },
    };

    const res = http.post(`${BASE_URL}/api/rooms`, null, params);
    roomCreateDuration.add(res.timings.duration);

    const isSuccess = check(res, {
      "status is 200": (r) => r.status === 200,
      "content-type is json": (r) => r.headers["Content-Type"] && r.headers["Content-Type"].includes("application/json"),
      "valid nanoid roomId returned": (r) => {
        try {
          const body = JSON.parse(r.body);
          return typeof body.roomId === "string" && body.roomId.length === 6;
        } catch {
          return false;
        }
      },
    });

    roomSuccessRate.add(isSuccess);
    if (isSuccess) {
      roomsCreated.add(1);
    }
  } else {
    const res = http.get(`${BASE_URL}/`, { tags: { name: "health_check" } });
    check(res, {
      "health check status is 200": (r) => r.status === 200,
    });
  }

  // Realistic human think-time jitter (0.5s - 1.0s)
  sleep(0.5 + Math.random() * 0.5);
}

// Generates an auto-formatted summary tailored for resume metrics
export function handleSummary(data) {
  const reqs = data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0;
  const rate = data.metrics.http_reqs ? data.metrics.http_reqs.values.rate.toFixed(1) : 0;
  const failRate = data.metrics.http_req_failed ? (data.metrics.http_req_failed.values.rate * 100).toFixed(2) : 0;
  const successRate = (100 - failRate).toFixed(2);
  const dur = data.metrics.room_create_duration || data.metrics.http_req_duration;
  const p50 = dur && dur.values.med !== undefined ? dur.values.med.toFixed(2) : "N/A";
  const p90 = dur && dur.values["p(90)"] !== undefined ? dur.values["p(90)"].toFixed(2) : "N/A";
  const p95 = dur && dur.values["p(95)"] !== undefined ? dur.values["p(95)"].toFixed(2) : "N/A";
  const p99 = dur && dur.values["p(99)"] !== undefined ? dur.values["p(99)"].toFixed(2) : "N/A";
  const totalRooms = data.metrics.rooms_created ? data.metrics.rooms_created.values.count : 0;

  const resumeBlock = `
======================================================================
  RESUME BENCHMARK METRICS (k6 Room Allocation Load Test)
======================================================================
• Total Requests Executed : ${reqs.toLocaleString()}
• Successful Rooms Created : ${totalRooms.toLocaleString()}
• Peak Throughput          : ${rate} req/sec
• Success / Completion Rate: ${successRate}% (${failRate}% error rate)
• Latency Percentiles:
    - Median (p50)         : ${p50} ms
    - 90th Percentile (p90): ${p90} ms
    - 95th Percentile (p95): ${p95} ms
    - 99th Percentile (p99): ${p99} ms
======================================================================
`;

  return {
    stdout: resumeBlock,
  };
}