import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 50 },   // ramp to 50 VUs
    { duration: "1m", target: 50 },    // hold
    { duration: "30s", target: 200 },  // spike
    { duration: "1m", target: 200 },
    { duration: "30s", target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<300"], // p95 under 300ms
    http_req_failed: ["rate<0.01"],   // <1% errors
  },
};

export default function () {
  const res = http.post(`${__ENV.BASE_URL}/api/rooms`);
  check(res, {
    "status is 200": (r) => r.status === 200,
    "returns roomId": (r) => JSON.parse(r.body).roomId !== undefined,
  });
  sleep(1);
}