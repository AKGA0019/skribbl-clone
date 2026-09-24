const { sampleWords } = require('./words');

class Game {
  constructor(room) {
    this.room = room;
    this.phase = 'lobby';
    this.round = 0;
    this.drawerIndex = -1;
    this.word = null;
    this.wordOptions = [];
    this.hints = [];
    this.strokes = [];
    this.startedAt = null;
    this.timer = null;
    this.roundEnding = false;
    this.roundEndEmitted = false;
    this.gameOverEmitted = false;
    this.lastAnnouncedRound = 0;
  }

  clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  get drawer() {
    return this.room.players[this.drawerIndex] || null;
  }

  begin() {
    this.phase = 'choosing';
    this.round = 1;
    this.drawerIndex = 0;
    this.startChoosing();
  }

  startChoosing() {
    this.clearTimer();
    this.phase = 'choosing';
    this.lastAnnouncedRound = 0;
    this.word = null;
    this.strokes = [];
    this.hints = [];
    this.roundEnding = false;
    this.room.players.forEach((p) => p.resetRound());
    this.wordOptions = sampleWords(this.room.settings.wordCount);
  }

  chooseWord(word) {
    const valid = this.wordOptions.some((item) => item.word === word);
    if (!valid || !this.drawer) return false;
    this.word = word;
    this.phase = 'drawing';
    this.startedAt = Date.now();
    this.strokes = [];
    this.scheduleEnd();
    return true;
  }

  scheduleEnd() {
    this.clearTimer();
    const ms = this.room.settings.drawTime * 1000;
    this.timer = setTimeout(() => this.endRound('time'), ms);
  }

  addHint() {
    if (!this.word || this.room.settings.hints <= 0) return;
    const positions = this.word.split('').map((_, i) => i).filter((i) => this.word[i] !== ' ' && !this.hints.includes(i));
    if (!positions.length) return;
    const next = positions[Math.floor(Math.random() * positions.length)];
    if (this.hints.length < this.room.settings.hints) this.hints.push(next);
  }

  checkGuess(player, text) {
    if (this.phase !== 'drawing' || !this.word || !player || player.id === this.drawer?.id || player.hasGuessed) return { correct: false, points: 0 };
    const normalize = (value) => value.toLowerCase().trim().replace(/\s+/g, ' ');
    const correct = normalize(text) === normalize(this.word);
    if (correct) {
      player.hasGuessed = true;
      const elapsed = (Date.now() - this.startedAt) / 1000;
      const points = Math.max(50, Math.round(100 + Math.max(0, this.room.settings.drawTime - elapsed)));
      player.addScore(points);
      const everyoneGuessed = this.room.players.filter((p) => p.id !== this.drawer?.id).every((p) => p.hasGuessed);
      if (everyoneGuessed) setTimeout(() => this.endRound('guessed'), 500);
      return { correct: true, points };
    }
    return { correct: false, points: 0 };
  }

  endRound(reason = 'time') {
    if (this.roundEnding || this.phase === 'game_over' || this.phase === 'lobby') return;
    this.roundEnding = true;
    this.roundEndEmitted = false;
    this.clearTimer();
    this.phase = 'round_end';
    const currentWord = this.word;
    setTimeout(() => {
      this.advanceRound();
    }, 2500);
    return { reason, word: currentWord };
  }

  advanceRound() {
    if (this.round >= this.room.settings.rounds) {
      this.phase = 'game_over';
      this.gameOverEmitted = false;
      return;
    }
    this.round += 1;
    this.drawerIndex = (this.drawerIndex + 1) % this.room.players.length;
    this.startChoosing();
  }

  getHintText() {
    if (!this.word) return '';
    return this.word.split('').map((char, i) => {
      if (char === ' ') return ' ';
      return this.hints.includes(i) ? char : '_';
    }).join(' ');
  }

  publicState() {
    return {
      phase: this.phase,
      round: this.round,
      totalRounds: this.room.settings.rounds,
      drawerId: this.drawer?.id || null,
      word: null,
      hints: this.getHintText(),
      strokes: this.strokes,
      wordOptions: [],
      drawTime: this.room.settings.drawTime,
      startedAt: this.startedAt,
      remaining: this.getRemaining(),
      scores: this.room.players.map((p) => ({ id: p.id, name: p.name, score: p.score }))
    };
  }

  getRemaining() {
    if (this.phase !== 'drawing' || !this.startedAt) return this.room.settings.drawTime;
    return Math.max(0, Math.ceil(this.room.settings.drawTime - (Date.now() - this.startedAt) / 1000));
  }
}

module.exports = Game;
