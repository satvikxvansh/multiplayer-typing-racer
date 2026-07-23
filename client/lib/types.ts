// Shared types between client and server for the race feature.
// Mirror these on your Socket.IO server (or share via a common package)
// so client and server events never drift out of sync.

export interface Racer {
  socketId: string;
  name: string;
  progressPercent: number; // 0-100 — always the server's number, not the client's own claim
  wpm: number; // server-calculated, not client-reported
  finished: boolean;
  finishTimeMs: number | null;
}

export type RaceStatus = "waiting" | "countdown" | "racing" | "finished";

export interface RaceState {
  roomId: string;
  status: RaceStatus;
  passage: string;
  racers: Racer[];
  countdownValue: number | null; // 3, 2, 1, then null/0 once racing starts
  maxRacers: number;
}

// ---- Client -> Server events ----
export interface ClientToServerEvents {
  join_room: (roomId: string) => void;
  leave_room: (roomId: string) => void;
  player_ready: (roomId: string) => void;
  typing_progress: (payload: {
    roomId: string;
    typedText: string;
    timestamp: number;
  }) => void;
}

// ---- Server -> Client events ----
export interface ServerToClientEvents {
  room_state: (state: RaceState) => void;
  countdown_tick: (value: number) => void;
  race_start: (payload: { passage: string; startTimestamp: number }) => void;
  opponent_progress: (payload: {
    socketId: string;
    progressPercent: number;
    wpm: number;
  }) => void;
  player_finished: (payload: {
    socketId: string;
    finishTimeMs: number;
    placement: number;
  }) => void;
  race_finished: (payload: { results: Racer[] }) => void;
  error_message: (message: string) => void;
}