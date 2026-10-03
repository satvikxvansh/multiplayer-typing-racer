// load-tests/processor.js
function recordEmitTime(requestParams, context, ee, next) {
  context.vars._emitTime = Date.now();
  return next();
}

function recordLatency(requestParams, response, context, ee, next) {
  const latency = Date.now() - context.vars._emitTime;
  ee.emit("histogram", "typing_progress_latency", latency);
  return next();
}

module.exports = { recordEmitTime, recordLatency };