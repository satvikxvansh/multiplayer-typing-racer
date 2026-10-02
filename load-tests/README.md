# Load Tests

## room-creation-load.js (k6)
Load-tests `POST /api/rooms` under ramping concurrent load.
    k6 run --env BASE_URL=<server-url> room-creation-load.js

## race-load-test.yml (Artillery)
Simulates concurrent races over Socket.IO — room join, ready-up, and
streamed typing_progress events.
    artillery run race-load-test.yml