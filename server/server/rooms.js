const { nanoid } = require("nanoid");

const rooms = new Map();

function createRoom() {
  const roomId = nanoid(6);
  rooms.set(roomId, {
    roomId,
    status: "waiting",
    passage: "",
    racers: [],
    countdownValue: null,
    maxRacers: 4,
  });
  return roomId;
}

function getRoom(roomId) {
  return rooms.get(roomId);
}

function addRacerToRoom(roomId, socketId) {
  const room = getRoom(roomId);
  if (!room) return null;
  room.racers.push({
    socketId,
    name: `Racer ${room.racers.length + 1}`,
    progressPercent: 0,
    wpm: 0,
    finished: false,
    finishTimeMs: null,
  });
  return room;
}

module.exports = { rooms, createRoom, getRoom, addRacerToRoom };