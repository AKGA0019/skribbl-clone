const Game = require('./Game');
const Player = require('./Player');

class Room {
  constructor(id, hostId, hostName, settings) {
    this.id = id;
    this.hostId = hostId;
    this.players = [new Player(hostId, hostName, true)];
    this.settings = settings;
    this.game = new Game(this);
    this.createdAt = Date.now();
    this.private = !!settings.private;
    this.chat = [];
  }

  addPlayer(id, name) {
    if (this.players.length >= this.settings.maxPlayers) throw new Error('Room is full');
    if (this.game.phase !== 'lobby') throw new Error('Game has already started');
    if (this.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw new Error('Name is already taken');
    const player = new Player(id, name, false);
    this.players.push(player);
    return player;
  }

  removePlayer(id) {
    const index = this.players.findIndex((p) => p.id === id);
    if (index < 0) return null;
    const removed = this.players.splice(index, 1)[0];
    if (this.players.length && removed.isHost) {
      this.players[0].isHost = true;
      this.hostId = this.players[0].id;
    }
    if (this.game.drawerIndex === index) {
      this.game.drawerIndex = this.players.length ? index % this.players.length : -1;
    } else if (this.game.drawerIndex > index) {
      this.game.drawerIndex -= 1;
    }
    return removed;
  }

  getPlayer(id) {
    return this.players.find((p) => p.id === id);
  }

  addChat(player, text, system = false) {
    const message = { id: `${Date.now()}-${Math.random()}`, playerId: player?.id || 'system', playerName: player?.name || 'System', text, system };
    this.chat.push(message);
    if (this.chat.length > 100) this.chat.shift();
    return message;
  }

  snapshot() {
    return {
      id: this.id,
      hostId: this.hostId,
      private: this.private,
      settings: this.settings,
      players: this.players.map((p) => ({ id: p.id, name: p.name, score: p.score, isHost: p.isHost, ready: p.ready })),
      game: this.game.publicState(),
      chat: this.chat.slice(-50)
    };
  }
}

module.exports = Room;
