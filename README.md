# Real-Time Multiplayer Typing Racer

A real-time multiplayer typing race built to explore server-authoritative game state, WebSocket synchronization, and LLM-assisted performance feedback. Players race head-to-head against a shared passage, with every keystroke validated server-side and live progress broadcast to the room.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Screenshots](#screenshots)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Socket Event Reference](#socket-event-reference)
- [Workflow Diagram](#workflow-diagram)
- [Sequence Diagram](#sequence-diagram)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

Pace is a browser-based typing race supporting up to four concurrent players per room. A player creates a room and shares its code, opponents join, and once everyone is ready the server runs a countdown and starts the race for all connected clients simultaneously. Throughout the race, each keystroke is streamed to the server, validated against the source passage, and turned into a live WPM and progress broadcast that every racer in the room can see.

The project is deliberately built around a **server-authoritative** model: no client-reported statistic — WPM, accuracy, completion, or race outcome — is trusted at face value. The server independently recomputes every figure from raw keystroke data, which is what keeps the race fair and the leaderboard meaningful.

## Features

- **Real-time multiplayer racing** for up to four players per room, built on WebSockets via Socket.IO
- **Room creation and joining** via shareable room codes, with REST-based room creation and socket-based room membership
- **Server-side countdown sequencing** that starts the race for all clients in sync
- **Server-authoritative validation** — progress, WPM, and race completion are computed from raw typed text on the server, not trusted from the client
- **Live opponent progress tracking**, rendered as animated per-racer progress lanes
- **Reconnection and disconnect handling**, so a dropped connection doesn't stall a race indefinitely
- **Per-second performance sampling**, capturing WPM, accuracy, and progress over time for each racer
- **Post-race performance graph**, visualizing pacing, speed dips, and accuracy trends across the full race timeline
- **AI-generated post-race feedback**, using the Claude API to turn a racer's raw stats (WPM, accuracy, backspaces, mistyped words, pacing trend) into short, specific coaching notes
- **Themed, cohesive UI** built around a dark, amber-accented "pace light" visual identity, implemented in Next.js, TypeScript, and Tailwind CSS

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | Next.js (App Router), TypeScript |
| Styling | Tailwind CSS |
| Real-time transport | Socket.IO (WebSockets) |
| Backend runtime | Node.js, Express |
| Charting | Recharts |
| AI integration | Claude API (Anthropic) |
| Room identifiers | nanoid |

## Screenshots


| Landing Page | Waiting Room |
|---|---|
| _screenshot_ | _screenshot_ |

| Live Race | Results & AI Feedback |
|---|---|
| _screenshot_ | _screenshot_ |

## Architecture

The system is split into two independently deployable pieces:

- **Client** — a Next.js application responsible for rendering race state and capturing user input. It holds no authoritative game logic; every meaningful number displayed (WPM, progress, race outcome) is derived from server-emitted events.
- **Server** — an Express application with a Socket.IO layer on top. It owns all room state, runs the countdown and per-second sampling timers, validates typed input against the source passage, and is the single point where race outcomes are finalized and AI feedback is generated.

Room state lives in server memory, keyed by room ID, and is not tied to any individual socket connection — this allows the server to reason about a room independently of which specific client is currently attached to it, which matters for reconnection handling and for timers (such as the countdown and per-second sampler) that must keep running regardless of any one player's connection state.

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm (or your package manager of choice)
- An Anthropic API key, for the AI feedback feature

### Installation

```bash
# clone the repository
git clone https://github.com/<your-username>/pace.git
cd pace

# install client dependencies
cd client
npm install

# install server dependencies
cd ../server
npm install
```

### Running locally

```bash
# from /server
npm run dev

# from /client, in a separate terminal
npm run dev
```

The client runs on `http://localhost:3000` by default; the server runs on `http://localhost:3001`.

## Environment Variables

**Server** (`server/.env`)

```
PORT=3001
ANTHROPIC_API_KEY=your_api_key_here
```

**Client** (`client/.env.local`)

```
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Never commit `.env` files. `ANTHROPIC_API_KEY` must only be referenced server-side and should never be exposed to the client bundle.

## Project Structure

```
client/
  app/
    page.tsx                    # home page — create/join room
    race/[roomId]/page.tsx      # race page — orchestrates race state
  components/
    race/
      PaceLights.tsx            # pre-race countdown indicator
      RacerTrack.tsx            # per-racer progress lane
      TypingPassage.tsx         # passage display and input capture
      WaitingRoom.tsx           # waiting-room and countdown overlay
  lib/
    types.ts                    # shared client/server event and state types
    socket.ts                   # typed Socket.IO client

server/
  index.js                      # Express + Socket.IO entry point
  socket/
    index.js                    # socket event wiring
  server/
    rooms.js                    # in-memory room store
    raceEngine.js                # countdown, race start, per-second sampling
    validation.js                # progress, WPM, and mistyped-word calculation
    feedback.js                  # AI feedback generation
```

## Socket Event Reference

**Client → Server**

| Event | Payload | Description |
|---|---|---|
| `join_room` | `roomId` | Joins an existing room |
| `leave_room` | `roomId` | Leaves a room |
| `player_ready` | `roomId` | Signals readiness to start |
| `typing_progress` | `{ roomId, typedText, timestamp }` | Streams current typed input |

**Server → Client**

| Event | Payload | Description |
|---|---|---|
| `room_state` | `RaceState` | Full room state snapshot |
| `countdown_tick` | `number` | Countdown value, 3 → 0 |
| `race_start` | `{ passage, startTimestamp }` | Race begins for all clients |
| `opponent_progress` | `{ socketId, progressPercent, wpm }` | Live progress broadcast |
| `player_finished` | `{ socketId, finishTimeMs, placement }` | A racer has completed the passage |
| `race_finished` | `{ results }` | Final results for the room |
| `race_stats` | `RaceStats` | Per-racer timeline and summary stats |
| `race_feedback` | `{ feedback }` | AI-generated coaching note, sent privately |
| `error_message` | `string` | Error, e.g. room not found |

## Workflow Diagram

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

## Sequence Diagram

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

## Roadmap

- Persistent match history and leaderboard storage
- ELO-style ranking between races
- Horizontal scaling via Redis-backed pub/sub across multiple server instances
- AI-generated passages, tuned by difficulty and topic
- Practice mode against a pacing bot

## License

Distributed under the MIT License. See `LICENSE` for details.