const Room = require('./Room');

function makeRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  create(hostId, hostName, settings) {
    let id;
    do id = makeRoomId(); while (this.rooms.has(id));
    const room = new Room(id, hostId, hostName, settings);
    this.rooms.set(id, room);
    return room;
  }

  get(id) {
    return this.rooms.get(String(id || '').trim().toUpperCase());
  }

  deleteIfEmpty(id) {
    const room = this.get(id);
    if (room && room.players.length === 0) {
      room.game.clearTimer();
      this.rooms.delete(room.id);
    }
  }

  publicRooms() {
    return [...this.rooms.values()]
      .filter((r) => !r.private && r.game.phase === 'lobby' && r.players.length < r.settings.maxPlayers)
      .map((r) => ({ id: r.id, players: r.players.length, maxPlayers: r.settings.maxPlayers }));
  }
}

module.exports = RoomManager;
