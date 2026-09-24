class Player {
  constructor(id, name, isHost = false) {
    this.id = id;
    this.name = name;
    this.score = 0;
    this.isHost = isHost;
    this.ready = true;
    this.connected = true;
    this.hasGuessed = false;
  }

  resetRound() {
    this.hasGuessed = false;
  }

  addScore(points) {
    this.score += points;
  }
}

module.exports = Player;
