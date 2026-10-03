const { nanoid } = require("nanoid");

const rooms = new Map();

// Configuration constants
const EMPTY_ROOM_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes before unjoined room is deleted
const ROOM_CLEANUP_DELAY_MS = 60 * 1000; // 60 seconds after race finished before room is deleted

function clearRoomTimers(room) {
  if (!room) return;
  if (room.countdownInterval) {
    clearInterval(room.countdownInterval);
    room.countdownInterval = null;
  }
  if (room.sampleInterval) {
    clearInterval(room.sampleInterval);
    room.sampleInterval = null;
  }
  if (room.emptyTimeout) {
    clearTimeout(room.emptyTimeout);
    room.emptyTimeout = null;
  }
  if (room.raceTimeout) {
    clearTimeout(room.raceTimeout);
    room.raceTimeout = null;
  }
  if (room.cleanupTimeout) {
    clearTimeout(room.cleanupTimeout);
    room.cleanupTimeout = null;
  }
}

function getPublicRoomState(room) {
  if (!room) return null;
  return {
    roomId: room.roomId,
    status: room.status,
    passage: room.passage,
    racers: room.racers.map((r) => ({
      socketId: r.socketId,
      name: r.name,
      progressPercent: r.progressPercent,
      wpm: r.wpm,
      finished: r.finished,
      finishTimeMs: r.finishTimeMs,
      disconnected: r.disconnected,
    })),
    countdownValue: room.countdownValue,
    maxRacers: room.maxRacers || 4,
    createdAt: room.createdAt,
    startTimestamp: room.startTimestamp,
  };
}

function createRoom() {
  const roomId = nanoid(6);
  const room = {
    roomId,
    status: "waiting",
    passage: "",
    racers: [],
    countdownValue: null,
    maxRacers: 4,
    createdAt: Date.now(),
    countdownInterval: null,
    sampleInterval: null,
    emptyTimeout: null,
    raceTimeout: null,
    cleanupTimeout: null,
    toJSON() {
      return getPublicRoomState(this);
    },
  };

  // Schedule auto-delete if no racers ever join this room
  room.emptyTimeout = setTimeout(() => {
    deleteRoom(roomId);
  }, EMPTY_ROOM_TIMEOUT_MS);

  rooms.set(roomId, room);
  return roomId;
}

function deleteRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  clearRoomTimers(room);
  rooms.delete(roomId);
  console.log(`Room ${roomId} deleted. Active rooms: ${rooms.size}`);
}

function getRoom(roomId) {
  return rooms.get(roomId);
}

function addRacerToRoom(roomId, socketId) {
  const room = getRoom(roomId);
  if (!room) return null;

  // Once a racer joins, cancel the unjoined empty room timeout
  if (room.emptyTimeout) {
    clearTimeout(room.emptyTimeout);
    room.emptyTimeout = null;
  }

  // Avoid adding duplicate racer entry for the same socket ID
  const existingRacer = room.racers.find((r) => r.socketId === socketId);
  if (existingRacer) {
    existingRacer.disconnected = false;
    return room;
  }

  room.racers.push({
    socketId,
    name: `Racer ${room.racers.length + 1}`,
    progressPercent: 0,
    wpm: 0,
    startTimestamp: null,
    finished: false,
    finishTimeMs: null,
    disconnected: false,
  });
  return room;
}

module.exports = {
  rooms,
  createRoom,
  getRoom,
  addRacerToRoom,
  deleteRoom,
  clearRoomTimers,
  getPublicRoomState,
  EMPTY_ROOM_TIMEOUT_MS,
  ROOM_CLEANUP_DELAY_MS,
};