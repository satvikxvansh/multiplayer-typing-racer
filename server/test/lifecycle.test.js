const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  rooms,
  createRoom,
  getRoom,
  addRacerToRoom,
  deleteRoom,
  clearRoomTimers,
} = require("../server/rooms");

const {
  startCountdown,
  cancelCountdown,
  startRace,
  forceFinishRace,
  checkRaceComplete,
} = require("../server/raceEngine");

function createMockIo() {
  const events = [];
  const roomsEmitted = {};

  return {
    events,
    roomsEmitted,
    to(roomId) {
      return {
        emit(event, data) {
          events.push({ roomId, event, data });
          if (!roomsEmitted[roomId]) roomsEmitted[roomId] = [];
          roomsEmitted[roomId].push({ event, data });
        },
      };
    },
    emit(event, data) {
      events.push({ event, data });
    },
  };
}

function createMockSocket(id) {
  const leftRooms = [];
  return {
    id,
    leave(roomId) {
      leftRooms.push(roomId);
    },
    leftRooms,
  };
}

describe("Room Lifecycle & Timer Cleanup", () => {
  beforeEach(() => {
    // Clear any rooms
    for (const [roomId] of rooms) {
      deleteRoom(roomId);
    }
  });

  test("Room creation sets up emptyTimeout and deletes room if no one joins", async () => {
    const roomId = createRoom();
    const room = getRoom(roomId);
    assert.ok(room, "Room should exist");
    assert.ok(room.emptyTimeout, "emptyTimeout should be set");
    assert.equal(rooms.size, 1);

    // Calling deleteRoom should clear timers and delete room
    deleteRoom(roomId);
    assert.equal(getRoom(roomId), undefined);
    assert.equal(rooms.size, 0);
  });

  test("Adding a racer to room clears emptyTimeout", () => {
    const roomId = createRoom();
    const room = getRoom(roomId);
    assert.ok(room.emptyTimeout);

    addRacerToRoom(roomId, "socket-1");
    assert.equal(room.emptyTimeout, null, "emptyTimeout should be cleared after racer joins");
    assert.equal(room.racers.length, 1);
  });

  test("Countdown timer is stored on room and can be cancelled", () => {
    const io = createMockIo();
    const roomId = createRoom();
    addRacerToRoom(roomId, "socket-1");
    addRacerToRoom(roomId, "socket-2");

    startCountdown(io, roomId);
    const room = getRoom(roomId);
    assert.equal(room.status, "countdown");
    assert.ok(room.countdownInterval, "countdownInterval should be set on room");

    // Cancel countdown
    cancelCountdown(io, roomId);
    assert.equal(room.status, "waiting");
    assert.equal(room.countdownInterval, null, "countdownInterval should be cleared");
  });

  test("Deleting room during countdown clears countdownInterval and deletes from rooms Map", () => {
    const io = createMockIo();
    const roomId = createRoom();
    addRacerToRoom(roomId, "socket-1");
    addRacerToRoom(roomId, "socket-2");

    startCountdown(io, roomId);
    const room = getRoom(roomId);
    assert.ok(room.countdownInterval);

    deleteRoom(roomId);
    assert.equal(rooms.has(roomId), false);
    assert.equal(room.countdownInterval, null);
  });

  test("startRace tracks sampleInterval on room and sets raceTimeout backstop", () => {
    const io = createMockIo();
    const roomId = createRoom();
    addRacerToRoom(roomId, "socket-1");
    addRacerToRoom(roomId, "socket-2");

    startRace(io, roomId);
    const room = getRoom(roomId);
    assert.equal(room.status, "racing");
    assert.ok(room.sampleInterval, "sampleInterval should be tracked on room");
    assert.ok(room.raceTimeout, "raceTimeout should be set as backstop");

    deleteRoom(roomId);
    assert.equal(room.sampleInterval, null);
    assert.equal(room.raceTimeout, null);
    assert.equal(rooms.has(roomId), false);
  });

  test("checkRaceComplete stops sampleInterval, raceTimeout, and cleans up room if all disconnected", async () => {
    const io = createMockIo();
    const roomId = createRoom();
    addRacerToRoom(roomId, "socket-1");
    addRacerToRoom(roomId, "socket-2");

    startRace(io, roomId);
    const room = getRoom(roomId);

    // Both racers disconnected
    room.racers[0].disconnected = true;
    room.racers[1].disconnected = true;

    await checkRaceComplete(io, roomId);

    assert.equal(rooms.has(roomId), false, "Room should be deleted immediately when all racers disconnected");
    assert.equal(room.sampleInterval, null);
    assert.equal(room.raceTimeout, null);
  });

  test("checkRaceComplete sets post-race cleanupTimeout if racers are still connected", async () => {
    const io = createMockIo();
    const roomId = createRoom();
    addRacerToRoom(roomId, "socket-1");
    addRacerToRoom(roomId, "socket-2");

    startRace(io, roomId);
    const room = getRoom(roomId);

    // One finished, one still connected
    room.racers[0].finished = true;
    room.racers[0].finishTimeMs = Date.now();
    room.racers[1].finished = true;
    room.racers[1].finishTimeMs = Date.now() + 500;

    await checkRaceComplete(io, roomId);

    assert.equal(room.status, "finished");
    assert.equal(room.sampleInterval, null);
    assert.ok(room.cleanupTimeout, "cleanupTimeout should be scheduled");
    assert.equal(rooms.has(roomId), true, "Room should stay alive during grace period for results");

    // When deleteRoom is called, cleanupTimeout is cleared
    deleteRoom(roomId);
    assert.equal(room.cleanupTimeout, null);
    assert.equal(rooms.has(roomId), false);
  });

  test("handleRacerLeave removes racer from waiting room, and schedules emptyTimeout if last racer leaves", () => {
    const { handleRacerLeave } = require("../socket");
    const io = createMockIo();
    const roomId = createRoom();

    addRacerToRoom(roomId, "socket-1");
    addRacerToRoom(roomId, "socket-2");

    const socket1 = createMockSocket("socket-1");
    const socket2 = createMockSocket("socket-2");

    // Socket 1 leaves
    handleRacerLeave(io, socket1, roomId);
    let room = getRoom(roomId);
    assert.ok(room);
    assert.equal(room.racers.length, 1);
    assert.equal(room.racers[0].socketId, "socket-2");

    // Socket 2 leaves (last racer in waiting room)
    handleRacerLeave(io, socket2, roomId);
    room = getRoom(roomId);
    assert.ok(room, "Room should not be deleted immediately to prevent race conditions");
    assert.equal(room.racers.length, 0);
    assert.ok(room.emptyTimeout, "emptyTimeout should be scheduled when waiting room becomes empty");

    // Cleanup via deleteRoom clears timer and removes room from Map
    deleteRoom(roomId);
    assert.equal(getRoom(roomId), undefined);
    assert.equal(rooms.has(roomId), false);
  });

  test("handleRacerLeave aborts countdown back to waiting if 1 racer leaves", () => {
    const { handleRacerLeave } = require("../socket");
    const io = createMockIo();
    const roomId = createRoom();

    addRacerToRoom(roomId, "socket-1");
    addRacerToRoom(roomId, "socket-2");
    startCountdown(io, roomId);

    let room = getRoom(roomId);
    assert.equal(room.status, "countdown");
    assert.ok(room.countdownInterval);

    const socket1 = createMockSocket("socket-1");
    handleRacerLeave(io, socket1, roomId);

    room = getRoom(roomId);
    assert.ok(room);
    assert.equal(room.status, "waiting", "Should revert to waiting status");
    assert.equal(room.countdownInterval, null, "Countdown interval should be cancelled");
    assert.equal(room.racers.length, 1);
    assert.equal(room.racers[0].socketId, "socket-2");
  });

  test("handleRacerLeave deletes room and stops countdown if all racers leave during countdown", () => {
    const { handleRacerLeave } = require("../socket");
    const io = createMockIo();
    const roomId = createRoom();

    addRacerToRoom(roomId, "socket-1");
    startCountdown(io, roomId);

    const socket1 = createMockSocket("socket-1");
    handleRacerLeave(io, socket1, roomId);

    assert.equal(getRoom(roomId), undefined, "Room should be deleted immediately when all racers leave countdown");
    assert.equal(rooms.has(roomId), false);
  });

  test("handleRacerLeave deletes room and stops sampleInterval if all racers leave during race", () => {
    const { handleRacerLeave } = require("../socket");
    const io = createMockIo();
    const roomId = createRoom();

    addRacerToRoom(roomId, "socket-1");
    addRacerToRoom(roomId, "socket-2");
    startRace(io, roomId);

    const room = getRoom(roomId);
    assert.ok(room.sampleInterval);

    const socket1 = createMockSocket("socket-1");
    const socket2 = createMockSocket("socket-2");

    handleRacerLeave(io, socket1, roomId);
    assert.ok(getRoom(roomId), "Room still alive while socket-2 is racing");

    handleRacerLeave(io, socket2, roomId);
    assert.equal(getRoom(roomId), undefined, "Room should be deleted immediately when all racers leave race");
    assert.equal(rooms.has(roomId), false);
    assert.equal(room.sampleInterval, null, "sampleInterval should be cleared");
  });

  test("handleRacerLeave deletes finished room immediately when all racers disconnect", async () => {
    const { handleRacerLeave } = require("../socket");
    const io = createMockIo();
    const roomId = createRoom();

    addRacerToRoom(roomId, "socket-1");
    startRace(io, roomId);

    const room = getRoom(roomId);
    room.racers[0].finished = true;
    room.racers[0].finishTimeMs = Date.now();

    await checkRaceComplete(io, roomId);
    assert.ok(getRoom(roomId), "Room in finished state awaiting results display");
    assert.ok(room.cleanupTimeout, "cleanupTimeout active");

    const socket1 = createMockSocket("socket-1");
    handleRacerLeave(io, socket1, roomId);

    assert.equal(getRoom(roomId), undefined, "Room should be deleted immediately when finished racers disconnect");
    assert.equal(room.cleanupTimeout, null, "cleanupTimeout should be cleared");
    assert.equal(rooms.has(roomId), false);
  });
});

