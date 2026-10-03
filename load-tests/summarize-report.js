const fs = require("fs");

const agg = JSON.parse(fs.readFileSync("report.json", "utf-8")).aggregate;
const c = agg.counters;

const created = c["vusers.created"] ?? 0;
const completed = c["vusers.completed"] ?? 0;
const failed = c["vusers.failed"] ?? 0;

console.log(`created=${created}  completed=${completed}  failed=${failed}`);
console.log(`completion rate: ${((completed / created) * 100).toFixed(1)}%`);

console.log("\nerrors:");
for (const [k, v] of Object.entries(c)) if (k.startsWith("errors.")) console.log(`  ${k}: ${v}`);

const s = agg.summaries?.["vusers.session_length"];
if (s) console.log(`\nsession_length (ms): median=${s.median}  p95=${s.p95}  p99=${s.p99}  max=${s.max}`);