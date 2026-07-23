# Multiplayer Typing Racer

```
Home page                          Server
   |                                  |
   |--- "Create Room" clicked ------->|
   |<---- { roomId: "a1B2c3" } -------|
   |                                  |
   | router.push(`/race/${roomId}`)   |
   |                                  |
   |==== lands on /race/[roomId] ====|
   |--- (page.tsx useEffect fires) -->|
   |--- socket.emit("join_room") ---->|   (this actually joins them)
```
```
App starts
      │
      ▼
getSocket()
      │
      ▼
Is socket already created?
      │
 ┌────┴────┐
 │         │
 No       Yes
 │         │
 ▼         ▼
io(...)   Return existing socket
 │
 ▼
Create Socket.IO client object
 │
 ▼
(autoConnect: false)
Don't connect yet
 │
 ▼
Return socket object
 │
 ▼
Later...
socket.connect()
 │
 ▼
WebSocket connection established
 │
 ▼
socket.emit(...)
socket.on(...)
```